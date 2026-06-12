/**
 * Shared SQL-generation + plain-English explanation for data quality rules.
 * Used by both the Rules page (to show what each rule does) and the Reports
 * page (to show how each rule actually ran against the warehouse).
 */
import type { Rule, Connection } from './types'

export interface RuleMechanics {
  failureMeans: string
  passCondition: string
  runFrequency: string
  impact: string
}

/** Build the SQL the rule will execute against the warehouse. */
export function buildRuleSql(rule: Rule, conn?: Connection): string {
  const schema = conn?.schema ?? '<schema>'
  const fq     = `${schema}.${rule.tableName}`
  const col    = rule.columnName ?? '<column>'
  const params = rule.parameters as Record<string, unknown> | undefined
  switch (rule.type) {
    case 'not_null':
      return `-- Counts how many rows have a NULL in "${col}"\nSELECT\n  COUNT(*)                                      AS total_rows,\n  COUNT(CASE WHEN "${col}" IS NULL THEN 1 END)  AS failing_rows\nFROM ${fq};`
    case 'unique':
      return `-- Detects duplicate values in "${col}"\nSELECT "${col}", COUNT(*) AS dup_count\nFROM ${fq}\nGROUP BY "${col}"\nHAVING COUNT(*) > 1;`
    case 'range': {
      const min = params?.min, max = params?.max
      const where: string[] = []
      if (min !== undefined) where.push(`"${col}" < ${min}`)
      if (max !== undefined) where.push(`"${col}" > ${max}`)
      const cond = where.join(' OR ') || `"${col}" IS NULL`
      return `-- Flags rows where "${col}" is outside [${min ?? '−∞'}, ${max ?? '+∞'}]\nSELECT *\nFROM ${fq}\nWHERE ${cond};`
    }
    case 'regex': {
      const pattern = (params?.pattern as string) ?? '.*'
      return `-- Flags rows whose "${col}" doesn't match /${pattern}/\nSELECT *\nFROM ${fq}\nWHERE NOT REGEXP_LIKE("${col}", '${pattern}');`
    }
    case 'freshness': {
      const hrs = params?.maxAgeHours ?? 24
      return `-- Asserts the table was updated within the last ${hrs}h\nSELECT MAX(LAST_ALTERED) AS last_updated,\n       DATEDIFF('hour', MAX(LAST_ALTERED), CURRENT_TIMESTAMP()) AS hours_old\nFROM INFORMATION_SCHEMA.TABLES\nWHERE TABLE_NAME = '${rule.tableName.toUpperCase()}';`
    }
    case 'row_count': {
      const min = params?.minRows ?? 0
      return `-- Asserts the table has at least ${min} rows\nSELECT COUNT(*) AS row_count,\n       CASE WHEN COUNT(*) >= ${min} THEN 'PASS' ELSE 'FAIL' END AS status\nFROM ${fq};`
    }
    case 'referential':
      return `-- Asserts every "${col}" exists in the parent dimension\nSELECT child."${col}"\nFROM ${fq} child\nLEFT JOIN <parent_table> parent ON child."${col}" = parent.<key>\nWHERE parent.<key> IS NULL;`
    case 'custom_sql':
      return `-- Custom SQL check (defined inline)\n${(params?.sql as string) ?? `SELECT 1 FROM ${fq};`}`
    default:
      return `-- ${rule.type}\nSELECT * FROM ${fq};`
  }
}

/** Plain-English explanation of what failure means + how it's evaluated. */
export function ruleMechanics(rule: Rule): RuleMechanics {
  const params = rule.parameters as Record<string, unknown> | undefined
  switch (rule.type) {
    case 'not_null':
      return {
        passCondition: `0% of rows have NULL in "${rule.columnName ?? 'column'}"`,
        failureMeans: 'One or more rows have a NULL value in the required column.',
        runFrequency: 'On every quality-check run (typically every hour).',
        impact: 'Downstream joins / aggregations on this column will silently drop these rows or produce incorrect results.',
      }
    case 'unique':
      return {
        passCondition: `Every value of "${rule.columnName ?? 'column'}" appears exactly once`,
        failureMeans: 'There are duplicate values where there should be none — typically a primary key or business identifier.',
        runFrequency: 'On every quality-check run.',
        impact: 'Joins on this column will multiply rows; revenue/count reports will be inflated.',
      }
    case 'range':
      return {
        passCondition: `All values of "${rule.columnName ?? 'column'}" are between ${params?.min ?? '−∞'} and ${params?.max ?? '+∞'}`,
        failureMeans: 'One or more rows have a value outside the configured numeric range.',
        runFrequency: 'On every quality-check run.',
        impact: 'Out-of-band values often indicate data-entry errors, fx-rate bugs, or a schema misinterpretation.',
      }
    case 'regex':
      return {
        passCondition: `All values of "${rule.columnName ?? 'column'}" match the pattern ${(params?.pattern as string) ?? ''}`,
        failureMeans: 'One or more rows have a value that doesn\'t match the required pattern (e.g. malformed email).',
        runFrequency: 'On every quality-check run.',
        impact: 'Marketing campaigns and integrations that rely on a strict format will reject or silently drop these records.',
      }
    case 'freshness':
      return {
        passCondition: `Table was updated within the last ${params?.maxAgeHours ?? 24} hours`,
        failureMeans: 'The table\'s LAST_ALTERED timestamp is older than the SLA — the load pipeline likely stalled.',
        runFrequency: 'Hourly (or more often for streaming tables).',
        impact: 'Reports built on this table show stale data; decisions are made on outdated numbers.',
      }
    case 'row_count':
      return {
        passCondition: `Table has at least ${params?.minRows ?? 0} rows`,
        failureMeans: 'Row count dropped below the threshold — partial load, bad ETL filter, or upstream outage.',
        runFrequency: 'On every quality-check run.',
        impact: 'Downstream aggregations under-count; KPI dashboards show drops that aren\'t real business changes.',
      }
    case 'referential':
      return {
        passCondition: `Every "${rule.columnName ?? 'foreign key'}" value exists in its parent dimension`,
        failureMeans: 'Orphan child records reference a parent that no longer exists or never did.',
        runFrequency: 'On every quality-check run.',
        impact: 'Broken joins return NULL for the parent attributes; categorisation and roll-ups become inconsistent.',
      }
    case 'custom_sql':
      return {
        passCondition: 'Custom SQL returns 0 failing rows',
        failureMeans: 'The custom SQL check returned at least one violating row.',
        runFrequency: 'On every quality-check run.',
        impact: 'Defined by the rule author — see the rule description.',
      }
    default:
      return { passCondition: '—', failureMeans: '—', runFrequency: '—', impact: '—' }
  }
}

/** Generic rules apply to every table in the schema; specific rules target one. */
export function isGenericRule(rule: { tableName?: string }): boolean {
  const t = (rule.tableName ?? '').trim()
  return t === '' || t === '*' || t.toUpperCase() === 'ALL' || t.toUpperCase() === 'ALL_TABLES'
}

/** Returns a human-friendly scope label. */
export function ruleScopeLabel(rule: { tableName?: string }): 'Generic' | 'Specific' {
  return isGenericRule(rule) ? 'Generic' : 'Specific'
}

export const RULE_TYPE_LABEL: Record<string, string> = {
  not_null:    'Not Null',
  unique:      'Unique',
  range:       'Range Check',
  regex:       'Regex Pattern',
  custom_sql:  'Custom SQL',
  freshness:   'Freshness',
  row_count:   'Row Count',
  referential: 'Referential',
}
