/**
 * Lightweight SQL parser that extracts column-to-column lineage from a
 * Snowflake view / materialized view DDL.
 *
 * The implementation is deliberately simple — it handles the patterns most
 * data teams use day-to-day (SELECT a, b, SUM(c) AS total FROM t) but does
 * NOT cover the full SQL grammar (no nested CTEs, no UNION reasoning, no
 * function-arg-tracking through WINDOW clauses, etc.).  It is good enough to
 * power a "what feeds this column?" panel without bringing in a 200 KB SQL AST
 * library.
 */

export interface ParsedColumn {
  /** Output column name as exposed by the view. */
  alias:      string
  /** Raw expression as it appeared in the SELECT clause. */
  expression: string
  /** Bare column-name identifiers referenced inside the expression. */
  sources:    string[]
  /** True when the expression looks like a single bare column reference. */
  passthrough: boolean
}

export interface ColumnLineageEntry {
  /** Lower-cased view name. */
  view:       string
  /** Output column name. */
  column:     string
  /** Resolved upstream { table, column } pairs (best-effort). */
  upstream:   Array<{ table: string; column: string }>
  /** Original expression (helpful for tooltips / DDL inspection). */
  expression: string
}

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','AS','NULL','IS','TRUE','FALSE',
  'CASE','WHEN','THEN','ELSE','END','GROUP','BY','ORDER','HAVING','DISTINCT',
  'UNION','ALL','JOIN','ON','INNER','LEFT','RIGHT','OUTER','FULL','CROSS',
  'IN','EXISTS','BETWEEN','LIKE','ILIKE','RLIKE','REGEXP','LIMIT','OFFSET',
  'WITH','RECURSIVE','OVER','PARTITION','WINDOW','RANGE','ROWS','UNBOUNDED',
  'PRECEDING','FOLLOWING','CURRENT','ROW','LATERAL','PIVOT','UNPIVOT','QUALIFY',
  'CREATE','OR','REPLACE','VIEW','MATERIALIZED','TABLE','SCHEMA','DATABASE',
])
const SQL_FUNCS = new Set([
  'SUM','COUNT','MAX','MIN','AVG','MEDIAN','STDDEV','VAR','VARIANCE',
  'COALESCE','NVL','IFNULL','NULLIF','GREATEST','LEAST',
  'CONCAT','SUBSTR','SUBSTRING','UPPER','LOWER','TRIM','LTRIM','RTRIM','REPLACE',
  'CAST','CONVERT','TO_CHAR','TO_NUMBER','TO_DATE','TO_TIMESTAMP','PARSE_JSON',
  'CURRENT_DATE','CURRENT_TIMESTAMP','CURRENT_USER','CURRENT_SCHEMA','CURRENT_DATABASE',
  'DATEDIFF','DATEADD','DATE_TRUNC','EXTRACT','YEAR','MONTH','DAY','HOUR','MINUTE','SECOND',
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD','FIRST_VALUE','LAST_VALUE','NTILE',
  'IDENTIFIER','REGEXP_LIKE','REGEXP_REPLACE','GET_DDL','RESULT_SCAN','LAST_QUERY_ID',
])

/** Strip line + block comments and string literals so the parser doesn't choke. */
function preClean(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"([^"]*)"/g, (_, inner) => inner)         // keep quoted identifiers
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a comma-delimited list at depth 0 (ignore commas inside parentheses). */
function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0, last = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      out.push(s.slice(last, i).trim())
      last = i + 1
    }
  }
  if (last < s.length) out.push(s.slice(last).trim())
  return out.filter(Boolean)
}

/**
 * Parse the SELECT list of a view's body into individual output columns +
 * the bare identifiers each one references.
 */
export function parseSelectList(sql: string): ParsedColumn[] {
  const cleaned = preClean(sql)
  // Find the first top-level SELECT … FROM clause. We allow optional CREATE … AS prefix.
  const match = cleaned.match(/SELECT\s+([\s\S]+?)\s+FROM\s+/i)
  if (!match) return []
  const selectClause = match[1]
  const items = splitTopLevel(selectClause)
  if (items.length === 1 && items[0].trim() === '*') return []  // SELECT * is unresolvable here

  return items.map(rawItem => {
    let item = rawItem.trim()

    // Detect alias:  expr AS alias  | expr alias  (only if expr is a bare column)
    let alias = ''
    let expression = item
    const asMatch = item.match(/^([\s\S]+?)\s+AS\s+([A-Za-z_][\w$]*)\s*$/i)
    if (asMatch) {
      expression = asMatch[1].trim()
      alias      = asMatch[2]
    } else {
      // Trailing-identifier alias only if the rest is "simple" — avoids splitting "a + b" into "a + b" alias.
      const tail = item.match(/^([\s\S]+?)\s+([A-Za-z_][\w$]*)\s*$/)
      if (tail) {
        const lhs = tail[1].trim()
        // Only interpret as alias when LHS is a bare or qualified column reference (no operators / no parens).
        if (/^[\w$.]+$/.test(lhs)) {
          expression = lhs
          alias      = tail[2]
        }
      }
    }
    if (!alias) {
      // Fallback: derive alias from the last identifier (works for "t.col" → col).
      const m = expression.match(/([A-Za-z_][\w$]*)\s*$/)
      alias = m ? m[1] : expression
    }

    // Extract bare identifiers — anything that looks like a column name.
    const sources: string[] = []
    const seen   = new Set<string>()
    const idRe   = /\b([A-Za-z_][\w$]*)\b/g
    let m: RegExpExecArray | null
    while ((m = idRe.exec(expression)) !== null) {
      const w = m[1]
      const upper = w.toUpperCase()
      if (SQL_KEYWORDS.has(upper)) continue
      if (SQL_FUNCS.has(upper))    continue
      if (/^\d/.test(w))           continue   // numeric literal
      if (seen.has(upper))         continue
      seen.add(upper)
      sources.push(upper)
    }

    // Strip table-qualifier prefixes (e.g. "T.COL" → keep "COL", not "T")
    // Sources may contain table aliases; we filter those out below at resolve-time.
    const passthrough = /^[A-Za-z_][\w$.]*$/.test(expression) && !/[(,*+\-/%]/.test(expression)

    return { alias: alias.toUpperCase(), expression, sources, passthrough }
  })
}

/**
 * Given the parsed SELECT list and the set of source tables / their columns,
 * resolve each output column to concrete upstream { table, column } pairs.
 *
 * `sourceTables` is a map of TABLE_NAME (uppercase) → set of column names (uppercase).
 */
export function resolveColumnLineage(
  viewName: string,
  parsed:   ParsedColumn[],
  sourceTables: Map<string, Set<string>>
): ColumnLineageEntry[] {
  const entries: ColumnLineageEntry[] = []
  for (const p of parsed) {
    const upstream: Array<{ table: string; column: string }> = []
    const sourceList = Array.from(sourceTables.entries())
    // For a passthrough column, prefer to find the column under a source table that has the alias name itself.
    const candidates = p.passthrough
      ? [p.alias, ...p.sources]
      : p.sources
    for (const colName of candidates) {
      for (const [table, cols] of sourceList) {
        if (cols.has(colName)) {
          upstream.push({ table, column: colName })
        }
      }
    }
    // De-dup
    const seen = new Set<string>()
    const dedup = upstream.filter(u => {
      const k = `${u.table}.${u.column}`
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    entries.push({ view: viewName, column: p.alias, upstream: dedup, expression: p.expression })
  }
  return entries
}
