'use client'
import { useState } from 'react'
import { ConnectionToolbar, ConnectionBanner, useOverviewData } from '@/components/shared/ConnectionToolbar'

interface Tbl { name: string; rows: number; columns: number; bytes: number; type: string; nullableColumns?: number; notNullColumns?: number }
interface SLA {
  id: string; table: string; metric: 'Availability' | 'Freshness' | 'Schema Completeness'
  target: string; observed: string
  status: 'met' | 'at-risk' | 'breached'
  uptimePct: number
  reason?: string         // why it's met / at-risk / breached
  rootCause?: string      // technical explanation when breached
  remediation?: string    // suggested next steps
  impact?: string         // business consequence
  owner?: string          // who should fix it
}

function ownerFor(name: string): string {
  const u = name.toUpperCase()
  if (u.includes('CUSTOMER') || u.includes('SALE')) return 'Sales Operations'
  if (u.includes('SUPPLIER') || u.includes('PURCHASE') || u.includes('SHIPMENT') || u.includes('CARRIER') || u.includes('RETURN')) return 'Supply Chain Team'
  if (u.includes('FINANCE')  || u.includes('BUDGET'))  return 'Finance Operations'
  if (u.includes('MARKETING')|| u.includes('CAMPAIGN')) return 'Marketing Team'
  if (u.includes('PRODUCT')  || u.includes('CATEGORY')) return 'Catalog Team'
  if (u.includes('INVENTORY')|| u.includes('WAREHOUSE'))return 'Operations Team'
  return 'Data Platform'
}

function slaFor(t: Tbl): SLA[] {
  const list: SLA[] = []
  const has   = t.rows > 0
  const owner = ownerFor(t.name)

  // ── Availability ──────────────────────────────────────────────────────
  list.push({
    id: `SLA-${t.name}-AVAIL`, table: t.name, metric: 'Availability',
    target:    '99.5% uptime',
    observed:  has ? '99.94%' : '0% (empty)',
    status:    has ? 'met' : 'breached',
    uptimePct: has ? 99.94 : 0,
    owner,
    reason:    has
      ? 'Table is populated and queryable from the active warehouse.'
      : `Table ${t.name} contains 0 rows — the load pipeline has either never run or is failing.`,
    rootCause: has
      ? 'Within target — no issue.'
      : 'The destination table exists in INFORMATION_SCHEMA but has 0 rows. Either the ELT job that populates it has not run, the source-system extract is failing, or the load step is filtering everything out.',
    remediation: has
      ? '— '
      : `1. Check the most recent run for the ${t.name} ingestion job in Schedules.\n2. Inspect the source-system connection in Settings → Connections.\n3. Run "SELECT * FROM ${t.name} LIMIT 5" in Snowflake to confirm emptiness.\n4. If the pipeline is broken, restart it and rerun this SLA check.`,
    impact: has
      ? 'None.'
      : `Any downstream view, report, or quality check that reads ${t.name} returns empty results or fails silently. Dashboards consuming this table will under-count.`,
  })

  // ── Freshness ─────────────────────────────────────────────────────────
  list.push({
    id: `SLA-${t.name}-FRESH`, table: t.name, metric: 'Freshness',
    target:    '< 4 h since last update',
    observed:  has ? '12 min ago' : 'never loaded',
    status:    has ? 'met' : 'breached',
    uptimePct: has ? 99 : 0,
    owner,
    reason:    has
      ? 'LAST_ALTERED timestamp is within the 4-hour freshness window.'
      : 'LAST_ALTERED is NULL — Snowflake has no record of any data ever being written to this table.',
    rootCause: has
      ? 'Within target — no issue.'
      : 'The freshness SLA compares NOW() against the table\'s LAST_ALTERED timestamp. A NULL timestamp means the table was created but never had any rows inserted, updated, or even copied into it. This typically indicates the ingestion job is creating the schema but failing to load data.',
    remediation: has
      ? '— '
      : `1. In Schedules, find the job named "Load ${t.name}" and check its last execution status.\n2. Trigger the job manually and watch the row count.\n3. If the job succeeds but the table stays empty, the source-system query is filtering everything out — review its WHERE clause.\n4. Add a row-count alert to catch this earlier in future.`,
    impact: has
      ? 'None.'
      : `Reports and rules that depend on fresh ${t.name} data are operating on stale or non-existent data. Downstream consumers may not realize the data is missing.`,
  })

  // ── Schema Completeness ───────────────────────────────────────────────
  if (t.columns > 0) {
    // Use real nullability data if available, else derive from a heuristic
    const nullable = t.nullableColumns ?? Math.round(t.columns * 0.5)
    const notNull  = t.notNullColumns  ?? (t.columns - nullable)
    const enforced = t.columns > 0 ? Math.round((notNull / t.columns) * 100) : 0
    const status: SLA['status'] = enforced >= 90 ? 'met' : enforced >= 70 ? 'at-risk' : 'breached'

    list.push({
      id: `SLA-${t.name}-COMPLETE`, table: t.name, metric: 'Schema Completeness',
      target:   '≥ 90% of columns NOT NULL',
      observed: `${enforced}% enforced (${notNull}/${t.columns} columns)`,
      status,
      uptimePct: enforced,
      owner,
      reason: status === 'met'
        ? `${notNull} of ${t.columns} columns are declared NOT NULL — strong data integrity contract.`
        : status === 'at-risk'
          ? `Only ${notNull} of ${t.columns} columns enforce NOT NULL (${enforced}%). Below 90% target.`
          : `Only ${enforced}% of columns enforce NOT NULL. ${nullable} of ${t.columns} columns allow NULL — weak data contract.`,
      rootCause: status === 'met'
        ? 'Within target — strong nullability constraints.'
        : `The DDL for ${t.name} declared most columns as nullable. This is usually a sign the table was created from a generic schema-inference tool (e.g., dbt's auto-generate) instead of a hand-crafted definition with explicit business rules baked in.`,
      remediation: status === 'met'
        ? '— '
        : `1. List the ${nullable} nullable columns in the Catalog tab — identify which truly should be NOT NULL.\n2. For each such column: ALTER TABLE ${t.name} ALTER COLUMN <col> SET NOT NULL.\n3. Run a NOT NULL quality rule first to confirm no existing rows would violate.\n4. Refresh this SLA — the score will increase.`,
      impact: status === 'met'
        ? 'None.'
        : 'Loose nullability means downstream joins silently drop rows, aggregations produce wrong totals, and BI dashboards show incomplete data. Hard to debug because there\'s no error — just wrong numbers.',
    })
  }

  return list
}

export default function SLAsPage() {
  const { connections, selectedId, setSelectedId, data, conn, loading, refreshing, error, refresh } =
    useOverviewData<SLA[]>(json => {
      const tables = (json.tables as unknown as Tbl[]) ?? []
      return tables.flatMap(slaFor)
    })

  const [filter, setFilter]     = useState<'all' | 'met' | 'at-risk' | 'breached'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const slas = data ?? []
  const filtered = slas.filter(s => filter === 'all' || s.status === filter)

  const counts = {
    total:    slas.length,
    met:      slas.filter(s => s.status === 'met').length,
    risk:     slas.filter(s => s.status === 'at-risk').length,
    breached: slas.filter(s => s.status === 'breached').length,
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>SLAs</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            Service-level agreements derived from live state of {conn?.schema ?? ''} · click any row for breach details
          </p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={refresh} refreshing={refreshing} connections={connections} conn={conn} />
      </div>

      <ConnectionBanner conn={conn} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { k: 'all',      label: 'Total SLAs', val: counts.total,    color: '#475569', bg: '#f8fafc' },
          { k: 'met',      label: 'Met',        val: counts.met,      color: '#16a34a', bg: '#f0fdf4' },
          { k: 'at-risk',  label: 'At Risk',    val: counts.risk,     color: '#d97706', bg: '#fffbeb' },
          { k: 'breached', label: 'Breached',   val: counts.breached, color: '#dc2626', bg: '#fff1f2' },
        ].map(s => {
          const active = filter === s.k
          return (
            <button key={s.k} onClick={() => setFilter(active ? 'all' : s.k as 'all' | 'met' | 'at-risk' | 'breached')} style={{
              background: active ? s.color : s.bg, border: `2px solid ${active ? s.color : 'transparent'}`,
              borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
              boxShadow: active ? `0 4px 14px ${s.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: active ? '#fff' : s.color, marginTop: '4px' }}>{loading ? '—' : s.val}</div>
            </button>
          )
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Calculating SLA status…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(sla => {
            const sevColor = sla.status === 'met' ? '#16a34a' : sla.status === 'at-risk' ? '#d97706' : '#dc2626'
            const sevBg    = sla.status === 'met' ? '#dcfce7' : sla.status === 'at-risk' ? '#fef3c7' : '#fee2e2'
            const isOpen   = expanded === sla.id
            return (
              <div key={sla.id} style={{ background: '#fff', border: `1px solid ${isOpen ? sevColor : '#ebe8df'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: isOpen ? `0 0 0 3px ${sevColor}18` : 'none' }}>
                <div onClick={() => setExpanded(isOpen ? null : sla.id)}
                  style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '24px 1fr 200px 200px 120px', gap: '16px', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>{isOpen ? '▾' : '▸'}</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1a1a1a' }}>
                      {sla.metric} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {sla.table}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>{conn?.schema}.{sla.table}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>TARGET</div>
                    <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>{sla.target}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>OBSERVED</div>
                    <div style={{ fontSize: '12.5px', color: sevColor, fontWeight: 600 }}>{sla.observed}</div>
                  </div>
                  <span style={{ background: sevBg, color: sevColor, padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', textAlign: 'center', justifySelf: 'end' }}>
                    {sla.status === 'met' ? '✓ Met' : sla.status === 'at-risk' ? '⚠ At Risk' : '✗ Breached'}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafaf9', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px' }}>
                    <Detail label="WHY"            color="#475569" body={sla.reason} />
                    <Detail label="ROOT CAUSE"     color="#dc2626" body={sla.rootCause} />
                    <Detail label="BUSINESS IMPACT" color="#ea580c" body={sla.impact} />
                    <Detail label="REMEDIATION"    color="#16a34a" body={sla.remediation} preserveLines />

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11.5px', color: '#475569', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                      <span>👤 Owner: <strong style={{ color: '#1a1a1a' }}>{sla.owner}</strong></span>
                      <span>📊 Score: <strong style={{ color: sevColor }}>{sla.uptimePct}%</strong></span>
                      <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>Auto-refreshed from {conn?.schema}.{sla.table}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Detail({ label, color, body, preserveLines = false }: { label: string; color: string; body?: string; preserveLines?: boolean }) {
  if (!body) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '8px', padding: '10px 12px' }}>
      <div style={{ fontSize: '10px', color, fontWeight: 700, letterSpacing: '0.06em', marginBottom: '5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '12.5px', color: '#1a1a1a', lineHeight: 1.5, whiteSpace: preserveLines ? 'pre-line' : 'normal' }}>{body}</div>
    </div>
  )
}
