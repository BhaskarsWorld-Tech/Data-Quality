'use client'
import { useState } from 'react'

type AnomalyStatus = 'open' | 'investigating' | 'resolved'
type Severity = 'critical' | 'high' | 'medium' | 'low'
type FilterType = 'all' | 'critical' | 'open' | 'resolved'

interface Anomaly {
  id: string; table: string; column: string; type: string
  severity: Severity; detected: string; delta: string; description: string
  status: AnomalyStatus; connection: string; domain: string
  rootCause: string; impact: string; recommendation: string
  affectedModels: string[]; baseline: string; observed: string
}

const anomalies: Anomaly[] = [
  {
    id: 'a1', table: 'fact_orders', column: 'revenue', type: 'Volume Spike',
    severity: 'critical', detected: '2026-05-05 14:22', delta: '+340%',
    description: 'Row count increased 340% vs 7-day baseline',
    status: 'open', connection: 'SF_Codex', domain: 'Finance',
    baseline: '~42K rows/hour', observed: '184K rows/hour',
    rootCause: 'A duplicate-fire bug in the order confirmation webhook inserted every order 4–5 times during a 22-minute window (14:00–14:22 UTC). The webhook retry logic did not check for existing order_ids before inserting, and the idempotency guard was bypassed because the Redis cache was cold after a deployment.',
    impact: 'Revenue is overstated by ~340% in all downstream dashboards. The Finance BI report shows $4.2M for the day instead of the actual ~$980K. LTV calculations and cohort analysis built on fact_orders are all corrupted for the affected window.',
    recommendation: 'Immediately run the deduplication script in sql/fixes/dedup_orders.sql. Add a DB-level UNIQUE constraint on order_id. Fix the webhook retry to use upsert semantics. Notify Finance to hold end-of-day reports until resolved.',
    affectedModels: ['revenue_by_channel', 'customer_ltv', 'cohort_analysis', 'finance_daily_report'],
  },
  {
    id: 'a2', table: 'dim_customers', column: 'email', type: 'Null Rate',
    severity: 'high', detected: '2026-05-05 11:05', delta: '+18%',
    description: 'Null email rate jumped from 2% to 20%',
    status: 'investigating', connection: 'SF_Codex', domain: 'Marketing',
    baseline: '~2% null rate', observed: '20% null rate (220K rows)',
    rootCause: 'A CRM migration script run at 10:45 UTC dropped email validation before inserting new lead-gen records from an external vendor batch. The script was missing a COALESCE fallback, causing empty strings to be stored as NULL. 220K of 1.1M customer records are affected.',
    impact: 'Marketing email campaigns cannot reach 220K customers — estimated missed re-engagement revenue of $480K/month. GA4 attribution is broken for these users as they cannot be matched by email. GDPR consent tracking is also impacted for these records.',
    recommendation: 'Quarantine affected records into dim_customers_email_review. Re-request email data from the vendor for the bad records. Add NOT NULL + email regex validation to the CRM import pipeline. Update the migration script with a validation step before insertion.',
    affectedModels: ['marketing_email_list', 'ga4_attribution', 'customer_segments', 'gdpr_consent_report'],
  },
  {
    id: 'a3', table: 'fact_inventory', column: 'stock_qty', type: 'Value Drift',
    severity: 'high', detected: '2026-05-04 22:30', delta: '-45%',
    description: 'Mean stock_qty dropped significantly outside normal range',
    status: 'open', connection: 'SF_Codex', domain: 'Supply Chain',
    baseline: 'Mean: 840 units/SKU', observed: 'Mean: 462 units/SKU',
    rootCause: 'The nightly warehouse sync job applied a unit-of-measure conversion (pallets → individual units) with an incorrect factor of 12 instead of 24, halving the effective stock quantities for 38% of SKUs. The error is confined to warehouse zone "W-North" where pallets are the native UOM.',
    impact: 'Reorder point calculations for 3,100 SKUs are based on artificially low stock numbers, triggering premature purchase orders worth ~$220K. Supply chain KPI dashboards show a false stockout rate of 31% vs actual 6%. The SCM API v2 consumer is making incorrect reorder decisions.',
    recommendation: 'Rerun the sync job with the corrected UOM factor (24). Cancel any POs triggered in the last 12 hours for W-North SKUs. Add a Z-score anomaly check (threshold: ±3σ) on stock_qty to catch future drift. Add a UOM validation step to the sync pipeline.',
    affectedModels: ['inventory_kpis', 'reorder_recommendations', 'scm_api_v2', 'supply_chain_dashboard'],
  },
  {
    id: 'a4', table: 'fact_payments', column: 'amount_usd', type: 'Schema Change',
    severity: 'critical', detected: '2026-05-04 18:00', delta: 'REMOVED',
    description: 'Column "amount_usd" removed — breaking downstream models',
    status: 'open', connection: 'SF_Codex', domain: 'Finance',
    baseline: 'Column present and populated', observed: 'Column does not exist',
    rootCause: 'A data engineer ran a schema migration (PR #3892) to rename amount_usd → payment_amount_usd for consistency with a new naming convention. The migration dropped the old column without first updating the 7 downstream dbt models and BI reports that reference it. The migration was approved but not checked for downstream impact.',
    impact: 'All 7 downstream dbt models fail with "column not found" errors. Finance weekly reports cannot be generated. Payment reconciliation with the bank is blocked. The Payments → Finance Reports data contract SLA is now in breach. Estimated $0 revenue visibility until resolved.',
    recommendation: 'Immediately add a column alias: ALTER TABLE fact_payments ADD COLUMN amount_usd FLOAT GENERATED ALWAYS AS (payment_amount_usd) VIRTUAL. Update all 7 downstream models to use the new column name. Add a schema change impact analysis step to the PR review checklist.',
    affectedModels: ['finance_weekly_report', 'payment_reconciliation', 'revenue_by_channel', 'fraud_detection', 'settlements_report', 'bank_recon_v2', 'finance_contracts'],
  },
  {
    id: 'a5', table: 'web_sessions', column: 'session_duration', type: 'Distribution Shift',
    severity: 'medium', detected: '2026-05-03 09:15', delta: '+92%',
    description: 'P95 session duration shifted from 8min to 15min',
    status: 'resolved', connection: 'SF_Codex', domain: 'Marketing',
    baseline: 'P95: ~8 min', observed: 'P95: ~15 min',
    rootCause: 'The session timeout was increased from 30 minutes to 60 minutes in a product A/B test deployed 2026-05-02. This caused sessions that previously would have split into two to merge into one, inflating P95 duration. Not a data quality issue but a product change not communicated to the data team.',
    impact: 'Average session duration KPI appeared to double, causing a false positive alert. Marketing dashboards showed inflated engagement metrics for ~18 hours. Resolved after root cause confirmed — no data corruption.',
    recommendation: 'Resolved. Data team added a comment to the web_sessions table documenting the session timeout change. Added a changelog feed from Product to notify Data on timeout/tracking changes. Added a P95 band alert with a ±30% threshold.',
    affectedModels: ['engagement_dashboard', 'session_kpis', 'marketing_attribution'],
  },
  {
    id: 'a6', table: 'dim_products', column: 'price', type: 'Freshness',
    severity: 'medium', detected: '2026-05-03 06:00', delta: '36h late',
    description: 'Table not updated in 36 hours — expected every 6 hours',
    status: 'resolved', connection: 'SF_Codex', domain: 'Catalog',
    baseline: 'Updated every 6h', observed: 'Last updated 36h ago',
    rootCause: 'The product price sync Airflow DAG failed silently due to an uncaught exception in the vendor API client when a rate-limit response was returned. The DAG showed "success" because the exception was swallowed in a try-catch block without re-raising. 6 consecutive runs failed silently.',
    impact: 'Product catalog showed stale prices for 36 hours. Any orders placed during this window used 36h-old prices — a total of 12 SKUs had prices that changed during the gap. Estimated pricing discrepancy of ~$3,200. Resolved and customer orders manually reviewed.',
    recommendation: 'Resolved. Fixed the Airflow DAG exception handling to properly raise errors. Added an explicit freshness check rule (max 8h). Added a Slack alert for silent DAG failures. Post-mortem completed.',
    affectedModels: ['product_catalog_api', 'pricing_engine', 'order_valuation'],
  },
  {
    id: 'a7', table: 'fact_returns', column: 'return_reason', type: 'Cardinality',
    severity: 'low', detected: '2026-05-02 14:00', delta: '+15 values',
    description: '15 new unexpected enum values appeared in return_reason',
    status: 'resolved', connection: 'SF_Codex', domain: 'Operations',
    baseline: '12 known enum values', observed: '27 values (15 new)',
    rootCause: 'Customer support agents in a new regional call center were given access to a returns portal that had a free-text "reason" field instead of a dropdown. The free-text entries were loaded directly into fact_returns without normalization, introducing 15 unrecognized enum values.',
    impact: 'Returns analytics reports showed an "Unknown" category spike of 15%. Trend analysis on return reasons was skewed for the affected 3-day window. No financial impact — purely a reporting quality issue.',
    recommendation: 'Resolved. Mapped the 15 free-text values to canonical enum values using a lookup table. Updated the returns portal for the new regional center to use a dropdown. Added a cardinality check rule on return_reason with an alert threshold of >15 distinct values.',
    affectedModels: ['returns_analytics', 'ops_kpi_dashboard'],
  },
]

const sevCfg: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  high:     { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  medium:   { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
  low:      { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
}
const stCfg: Record<string, { bg: string; color: string }> = {
  open:          { bg: '#fee2e2', color: '#dc2626' },
  investigating: { bg: '#fff7ed', color: '#ea580c' },
  resolved:      { bg: '#f0fdf4', color: '#16a34a' },
}
const typeColor: Record<string, string> = {
  'Volume Spike': '#6366f1', 'Null Rate': '#ec4899', 'Value Drift': '#f59e0b',
  'Schema Change': '#ef4444', 'Distribution Shift': '#8b5cf6',
  'Freshness': '#0ea5e9', 'Cardinality': '#14b8a6',
}

export default function AnomaliesPage() {
  const [filter, setFilter]     = useState<FilterType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch]     = useState('')

  const total    = anomalies.length
  const critical = anomalies.filter(a => a.severity === 'critical').length
  const open     = anomalies.filter(a => a.status === 'open').length
  const resolved = anomalies.filter(a => a.status === 'resolved').length

  const filtered = anomalies.filter(a => {
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'critical' ? a.severity === 'critical' :
      filter === 'open'     ? a.status === 'open' :
      filter === 'resolved' ? a.status === 'resolved' : true
    const matchSearch = search === '' ||
      a.table.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const statCards = [
    { key: 'all'      as FilterType, label: 'Total Detected', value: total,    icon: '📡', color: '#6366f1', activeBg: '#6366f1' },
    { key: 'critical' as FilterType, label: 'Critical',       value: critical,  icon: '🔴', color: '#dc2626', activeBg: '#dc2626' },
    { key: 'open'     as FilterType, label: 'Open',           value: open,      icon: '⚠️', color: '#ea580c', activeBg: '#ea580c' },
    { key: 'resolved' as FilterType, label: 'Resolved (7d)',  value: resolved,  icon: '✅', color: '#16a34a', activeBg: '#16a34a' },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Anomalies</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>AI-detected data anomalies across all monitored datasets</p>
        </div>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', color: '#dc2626', fontWeight: 600 }}>
          ⚡ {critical} critical · {open} open
        </div>
      </div>

      {/* Clickable stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(card => {
          const isActive = filter === card.key
          return (
            <div key={card.key} onClick={() => setFilter(isActive && card.key !== 'all' ? 'all' : card.key)}
              style={{
                background: isActive ? card.activeBg : '#fff',
                border: `2px solid ${isActive ? card.activeBg : '#ebe8df'}`,
                borderRadius: '12px', padding: '16px 20px', cursor: 'pointer',
                boxShadow: isActive ? `0 4px 16px ${card.activeBg}40` : 'none',
                transition: 'all 0.18s',
              }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>{card.icon}</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: isActive ? '#fff' : card.color }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: isActive ? 'rgba(255,255,255,0.8)' : '#64748b', marginTop: '2px' }}>{card.label}</div>
              {isActive && card.key !== 'all' && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', marginTop: '3px' }}>Click to clear filter</div>}
            </div>
          )
        })}
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by table, type, or description…"
          style={{ width: '100%', padding: '9px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a', boxSizing: 'border-box', outline: 'none' }} />
      </div>

      {/* Filter label */}
      {filter !== 'all' && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>Showing:</span>
          <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{filter}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => setFilter('all')} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>✕ Clear</button>
        </div>
      )}

      {/* Anomaly list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(a => {
          const sc = sevCfg[a.severity]
          const st = stCfg[a.status]
          const tc = typeColor[a.type] || '#64748b'
          const isOpen = expanded === a.id

          return (
            <div key={a.id} style={{
              background: '#fff',
              border: `1.5px solid ${isOpen ? '#6366f1' : a.status === 'resolved' ? '#d1fae5' : sc.border}`,
              borderRadius: '14px', overflow: 'hidden',
              boxShadow: isOpen ? '0 6px 24px rgba(99,102,241,0.13)' : '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s',
            }}>

              {/* Summary row */}
              <div onClick={() => setExpanded(isOpen ? null : a.id)}
                style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none' }}>

                {/* Severity bar */}
                <div style={{ width: '4px', alignSelf: 'stretch', background: sc.color, borderRadius: '2px', flexShrink: 0 }} />

                {/* Severity + Type badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, minWidth: '90px' }}>
                  <span style={{ background: sc.bg, color: sc.color, padding: '2px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700 }}>{a.severity}</span>
                  <span style={{ background: `${tc}18`, color: tc, padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600 }}>{a.type}</span>
                </div>

                {/* Table / column */}
                <div style={{ minWidth: '160px', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a' }}>{a.table}</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{a.column} · {a.domain}</div>
                </div>

                {/* Description */}
                <div style={{ flex: 1, fontSize: '13px', color: '#475569', minWidth: 0 }}>{a.description}</div>

                {/* Delta */}
                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px', color: a.delta.startsWith('+') || a.delta === 'REMOVED' ? '#dc2626' : '#ea580c', flexShrink: 0, minWidth: '70px', textAlign: 'center' }}>{a.delta}</div>

                {/* Detected + Status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ ...st, padding: '3px 10px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>{a.status}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{a.detected}</span>
                </div>

                {/* Expand toggle */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: isOpen ? '#6366f1' : '#f1f5f9',
                  color: isOpen ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', transition: 'all 0.18s',
                }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafd' }}>

                  {/* Metadata bar */}
                  <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'Connection', value: a.connection },
                      { label: 'Domain',     value: a.domain },
                      { label: 'Baseline',   value: a.baseline },
                      { label: 'Observed',   value: a.observed },
                      { label: 'Detected',   value: a.detected },
                    ].map((m, i) => (
                      <div key={i} style={{ flex: 1, padding: '10px 16px', borderRight: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.label}</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Root Cause */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e7ff', overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(90deg, #eef2ff, #f5f3ff)', padding: '10px 16px', borderBottom: '1px solid #e0e7ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>🔍</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Root Cause — Why did this happen?</span>
                      </div>
                      <div style={{ padding: '14px 16px', fontSize: '13px', color: '#1e293b', lineHeight: '1.7' }}>{a.rootCause}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Business Impact */}
                      <div style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${sc.border}`, overflow: 'hidden' }}>
                        <div style={{ background: sc.bg, padding: '10px 16px', borderBottom: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>💥</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Business Impact</span>
                        </div>
                        <div style={{ padding: '14px 16px', fontSize: '13px', color: '#1e293b', lineHeight: '1.7' }}>{a.impact}</div>
                      </div>

                      {/* Recommended Fix */}
                      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                        <div style={{ background: '#f0fdf4', padding: '10px 16px', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>✅</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommended Fix</span>
                        </div>
                        <div style={{ padding: '14px 16px', fontSize: '13px', color: '#1e293b', lineHeight: '1.7' }}>{a.recommendation}</div>
                      </div>
                    </div>

                    {/* Affected downstream models */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e9eef5', padding: '14px 16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                        🔗 Affected Downstream Models
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {a.affectedModels.map(m => (
                          <code key={m} style={{ background: '#f1f5f9', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid #e2e8f0' }}>{m}</code>
                        ))}
                      </div>
                    </div>

                    {/* Collapse */}
                    <div>
                      <button onClick={() => setExpanded(null)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>
                        ▲ Collapse
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
            No anomalies match your filters
          </div>
        )}
      </div>
    </div>
  )
}
