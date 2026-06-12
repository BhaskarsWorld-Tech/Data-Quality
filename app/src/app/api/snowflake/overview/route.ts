import { NextRequest, NextResponse } from 'next/server'
import { getTableMetadata, getColumnMetadata, previewTable, getViewDefinitions, getMaterializedViewDefinitions, getConnectionSummary } from '@/lib/snowflake'
import { parseSelectList, resolveColumnLineage, ColumnLineageEntry } from '@/lib/columnLineage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TableInfo {
  name:      string
  type:      string
  rows:      number
  bytes:     number
  columns:   number
  nullableColumns: number
  notNullColumns:  number
}

interface QualityIssue {
  id:           string
  table:        string
  severity:     'critical' | 'warning' | 'info'
  category:     'completeness' | 'freshness' | 'volume' | 'schema'
  title:        string
  detail:       string
  recommendation: string
}

export async function GET(req: NextRequest) {
  try {
    const connectionId = new URL(req.url).searchParams.get('connectionId') ?? undefined
    const summary      = await getConnectionSummary(connectionId)
    const rawTables    = await getTableMetadata(connectionId)

    // Fetch columns for every table in parallel
    type EnrichedRow = TableInfo & Record<string, unknown> & {
      preview: Record<string, unknown>[]
      columnDetails: Array<{ name: string; type: string; nullable: string; position: number }>
    }
    const tablesWithCols: EnrichedRow[] = await Promise.all(
      rawTables.map(async (t) => {
        let columns = 0, nullableColumns = 0, notNullColumns = 0
        let columnDetails: Array<{ name: string; type: string; nullable: string; position: number }> = []
        try {
          const cols = await getColumnMetadata(t.TABLE_NAME as string, connectionId)
          columns = cols.length
          nullableColumns = cols.filter(c => c.IS_NULLABLE === 'YES').length
          notNullColumns  = columns - nullableColumns
          columnDetails = cols.map(c => ({
            name:     c.COLUMN_NAME as string,
            type:     c.DATA_TYPE   as string,
            nullable: c.IS_NULLABLE as string,
            position: c.ORDINAL_POSITION as number,
          }))
        } catch { /* ignore per-table errors */ }

        // Lazy preview for populated tables
        let preview: Record<string, unknown>[] = []
        if (((t.ROW_COUNT as number) ?? 0) > 0) {
          try { preview = await previewTable(t.TABLE_NAME as string, 200, connectionId) }
          catch { preview = [] }
        }

        return {
          // New normalized fields
          name:    t.TABLE_NAME as string,
          type:    (t.TABLE_TYPE as string) ?? 'TABLE',
          rows:    (t.ROW_COUNT  as number) ?? 0,
          bytes:   (t.BYTES      as number) ?? 0,
          columns, nullableColumns, notNullColumns,
          columnDetails,
          // Legacy uppercase fields kept for data-browser compatibility
          TABLE_NAME:    t.TABLE_NAME,
          TABLE_TYPE:    t.TABLE_TYPE,
          ROW_COUNT:     t.ROW_COUNT,
          BYTES:         t.BYTES,
          CREATED:       t.CREATED,
          LAST_ALTERED:  t.LAST_ALTERED,
          TABLE_SCHEMA:  t.TABLE_SCHEMA,
          TABLE_CATALOG: t.TABLE_CATALOG,
          preview,
        }
      })
    )

    /* ─── derive real quality metrics from live state ──────────────────── */
    const tableCount = tablesWithCols.length
    const populated  = tablesWithCols.filter(t => t.rows > 0).length
    const empty      = tableCount - populated
    const totalRows  = tablesWithCols.reduce((s, t) => s + t.rows,  0)
    const totalBytes = tablesWithCols.reduce((s, t) => s + t.bytes, 0)
    const totalCols  = tablesWithCols.reduce((s, t) => s + t.columns, 0)
    const nullableCols = tablesWithCols.reduce((s, t) => s + t.nullableColumns, 0)
    const notNullCols  = totalCols - nullableCols

    const completenessScore = totalCols > 0 ? Math.round((notNullCols / totalCols) * 100) : 0
    const populationScore   = tableCount > 0 ? Math.round((populated / tableCount) * 100) : 0
    const schemaHealthScore = tablesWithCols.every(t => t.columns > 0) ? 100 : 80
    const overallScore      = Math.round((completenessScore + populationScore + schemaHealthScore) / 3)

    /* ─── derive real issues from table state ──────────────────────────── */
    const issues: QualityIssue[] = []
    tablesWithCols.forEach((t, i) => {
      if (t.rows === 0) {
        issues.push({
          id:       `EMPTY-${String(i + 1).padStart(3, '0')}`,
          table:    t.name,
          severity: 'warning',
          category: 'volume',
          title:    `${t.name} has no data`,
          detail:   `Table is defined with ${t.columns} column${t.columns === 1 ? '' : 's'} but contains 0 rows. Either the load pipeline hasn't run yet, or there is an upstream extract failure.`,
          recommendation: `Verify the ingestion job for ${t.name}. Check pipeline schedules, source-system connectivity, and recent run logs.`,
        })
      }
      if (t.columns > 0 && t.nullableColumns / t.columns > 0.7) {
        issues.push({
          id:       `NULL-${String(i + 1).padStart(3, '0')}`,
          table:    t.name,
          severity: 'warning',
          category: 'completeness',
          title:    `${t.name} has weak nullability constraints`,
          detail:   `${t.nullableColumns} of ${t.columns} columns (${Math.round(t.nullableColumns / t.columns * 100)}%) allow NULL. This makes downstream joins and aggregations fragile.`,
          recommendation: `Review the schema for ${t.name} and add NOT NULL constraints to columns that should never be empty (IDs, foreign keys, business-critical fields).`,
        })
      }
      if (t.columns === 0) {
        issues.push({
          id:       `META-${String(i + 1).padStart(3, '0')}`,
          table:    t.name,
          severity: 'critical',
          category: 'schema',
          title:    `Unable to read schema for ${t.name}`,
          detail:   `Column metadata could not be retrieved. The table may be inaccessible to the current role or recently dropped.`,
          recommendation: `Verify role permissions and confirm the table exists in ${summary.warehouse}.${summary.schema}.`,
        })
      }
    })

    /* ─── derive anomalies — 3 detection types ─────────────────────────── */
    type AnomalyRow = {
      id: string; table: string; type: string;
      severity: 'critical' | 'high' | 'medium'
      observed: string; baseline: string; delta: string
      description: string; status: 'open'
    }

    const anomalies: AnomalyRow[] = []

    // Type 1: Empty base tables (table exists but has 0 rows — critical anomaly)
    tablesWithCols
      .filter(t => t.rows === 0 && t.type === 'BASE TABLE')
      .forEach(t => {
        anomalies.push({
          id:          `ANOM-EMPTY-${t.name}`,
          table:       t.name,
          type:        'Empty Table',
          severity:    'critical',
          observed:    '0 rows',
          baseline:    'expected: > 0 rows for a base table',
          delta:       '-100%',
          description: `${t.name} is defined as a BASE TABLE but contains no data — the load pipeline never ran or is failing silently.`,
          status:      'open',
        })
      })

    // Type 2: Volume outliers — row counts >1σ from the schema mean
    const populatedTables = tablesWithCols.filter(t => t.rows > 0)
    const rowSizes        = populatedTables.map(t => t.rows)
    const mean            = rowSizes.length ? rowSizes.reduce((s, n) => s + n, 0) / rowSizes.length : 0
    const std             = rowSizes.length > 1
      ? Math.sqrt(rowSizes.reduce((s, n) => s + (n - mean) ** 2, 0) / rowSizes.length)
      : 0

    populatedTables
      .filter(t => std > 0 && Math.abs(t.rows - mean) > 1.0 * std)
      .forEach(t => {
        const sigmas = Math.abs(t.rows - mean) / Math.max(std, 1)
        const severity: AnomalyRow['severity'] =
          sigmas > 2.5 ? 'critical' :
          sigmas > 1.5 ? 'high'     : 'medium'
        const isSpike = t.rows > mean
        const pct = Math.round((t.rows / Math.max(mean, 1) - 1) * 100)
        anomalies.push({
          id:          `ANOM-VOL-${t.name}`,
          table:       t.name,
          type:        isSpike ? 'Volume Spike' : 'Volume Drop',
          severity,
          observed:    `${t.rows.toLocaleString()} rows`,
          baseline:    `Schema mean ≈ ${Math.round(mean).toLocaleString()} rows`,
          delta:       isSpike ? `+${pct}%` : `${pct}%`,
          description: `${t.name} row count is ${sigmas.toFixed(1)}σ from schema average — ${isSpike ? 'unusually large' : 'unusually small'} relative to peers.`,
          status:      'open',
        })
      })

    // Type 3: High-nullability outliers (data-quality smell)
    tablesWithCols
      .filter(t => t.columns > 0 && t.nullableColumns / t.columns >= 0.8)
      .forEach(t => {
        const pct = Math.round((t.nullableColumns / t.columns) * 100)
        anomalies.push({
          id:          `ANOM-NULL-${t.name}`,
          table:       t.name,
          type:        'Schema Weakness',
          severity:    pct >= 90 ? 'high' : 'medium',
          observed:    `${pct}% nullable (${t.nullableColumns}/${t.columns} columns)`,
          baseline:    'expected: ≥ 70% NOT NULL enforcement',
          delta:       `${pct - 50}% above 50% threshold`,
          description: `${t.name} allows NULL in ${pct}% of its columns — joins and aggregations downstream will silently drop rows.`,
          status:      'open',
        })
      })

    /* ─── parse view + materialized-view definitions for REAL lineage edges ─── */
    type ViewDep = { view: string; references: string[] }
    let viewDeps:        ViewDep[] = []
    let columnLineage:   ColumnLineageEntry[] = []
    try {
      // Pull regular views and materialized views in parallel and merge.
      const [vDefs, mvDefs] = await Promise.all([
        getViewDefinitions(connectionId).catch(() => []),
        getMaterializedViewDefinitions(connectionId).catch(() => []),
      ])
      const allDefs = [...vDefs, ...mvDefs]
      // Sorted by length desc so longer table names match before shorter substrings
      const tableNames = tablesWithCols.map(t => t.name).sort((a, b) => b.length - a.length)

      // Map each table → its uppercased column-name set (for column resolution below)
      const colSetByTable = new Map<string, Set<string>>()
      tablesWithCols.forEach(t => {
        colSetByTable.set(t.name.toUpperCase(), new Set(t.columnDetails.map(c => c.name.toUpperCase())))
      })

      viewDeps = allDefs.map(d => {
        const viewName = (d.TABLE_NAME as string) ?? ''
        const rawSql   = (d.VIEW_DEFINITION as string) ?? ''
        const sql      = rawSql.toUpperCase()
        // Strip string literals and comments to avoid matches inside them
        const cleaned  = sql
          .replace(/'[^']*'/g, '')
          .replace(/--[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
        const references = tableNames.filter(t => {
          if (t === viewName) return false
          const re = new RegExp(`\\b${t.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
          return re.test(cleaned)
        })

        // ─── Column-level lineage for this view ───────────────────────────
        const parsed = parseSelectList(rawSql)
        // Limit upstream lookup to the tables this view actually references
        const refSet = new Set(references.map(r => r.toUpperCase()))
        const localColSet = new Map<string, Set<string>>()
        for (const [tbl, cols] of colSetByTable.entries()) {
          if (refSet.has(tbl)) localColSet.set(tbl, cols)
        }
        const lineage = resolveColumnLineage(viewName, parsed, localColSet)
        columnLineage.push(...lineage)

        return { view: viewName, references }
      })
    } catch { /* INFORMATION_SCHEMA.VIEWS may be empty or unauthorized */ }

    return NextResponse.json({
      connection: summary,
      summary: {
        tableCount, populated, empty,
        totalRows, totalBytes,
        totalCols, nullableCols, notNullCols,
        overallScore, completenessScore, populationScore, schemaHealthScore,
      },
      tables: tablesWithCols,
      viewDeps,
      columnLineage,
      issues,
      anomalies,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
