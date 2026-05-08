'use client'
import { useState } from 'react'

type Issue = { rule: string; severity: 'critical' | 'warning' | 'info'; detail: string; impact: string }
type Asset = {
  id: string; name: string; schema: string; type: string; domain: string
  owner: string; score: number; columns: number; rows: string; tags: string[]
  connection: string; updated: string; desc: string; issues: Issue[]
}

const assets: Asset[] = [
  {
    id: 'c1', name: 'fact_orders', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Finance',
    owner: 'Bhaskar R.', score: 94, columns: 28, rows: '4.2M', tags: ['core', 'revenue'],
    connection: 'SF_Codex', updated: '2026-05-05 12:00',
    desc: 'Central orders fact table with line-item revenue, discounts, and fulfillment status.',
    issues: [
      { rule: 'Revenue > 0 Validity', severity: 'warning', detail: '8,400 records (0.2%) have revenue ≤ 0', impact: 'Minor revenue calculation skew in finance reports' },
      { rule: 'Freshness Check', severity: 'info', detail: 'Table refreshed 12 min ago — within SLA', impact: 'No impact' },
    ],
  },
  {
    id: 'c2', name: 'dim_customers', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Marketing',
    owner: 'Priya M.', score: 81, columns: 19, rows: '1.1M', tags: ['pii', 'customer'],
    connection: 'SF_Codex', updated: '2026-05-05 08:00',
    desc: 'Customer master dimension with contact info, segment, and lifetime value.',
    issues: [
      { rule: 'Email Format Check', severity: 'critical', detail: '220,000 records (20%) have invalid email format — regex [a-z]+@[a-z]+\\.[a-z]+ fails', impact: 'Email campaigns will bounce; marketing attribution broken' },
      { rule: 'Consent Flag Completeness', severity: 'warning', detail: '143,000 records (13%) missing GDPR consent flag', impact: 'Compliance risk — cannot lawfully market to these users' },
      { rule: 'Customer ID Uniqueness', severity: 'info', detail: 'All 1.1M customer IDs are unique', impact: 'No impact' },
    ],
  },
  {
    id: 'c3', name: 'fact_inventory', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Supply Chain',
    owner: 'Rajan S.', score: 76, columns: 14, rows: '820K', tags: ['ops'],
    connection: 'SF_Codex', updated: '2026-05-04 23:00',
    desc: 'Real-time inventory levels, reorder points, and warehouse locations.',
    issues: [
      { rule: 'Stock Level ≥ 0', severity: 'critical', detail: '4,100 SKUs (0.5%) show negative stock — likely unmatched returns', impact: 'Incorrect reorder signals; potential over-ordering costing ~$240K' },
      { rule: 'Warehouse Code Valid', severity: 'critical', detail: '12 records reference warehouse code "WH-999" which does not exist in dim_warehouses', impact: 'Broken joins cause NULL warehouse in downstream reports' },
      { rule: 'Freshness SLA', severity: 'warning', detail: 'Last refresh was 23h ago — SLA requires every 4 hours', impact: 'Inventory decisions based on stale data; stockout risk elevated' },
    ],
  },
  {
    id: 'c4', name: 'fact_payments', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Finance',
    owner: 'Bhaskar R.', score: 62, columns: 22, rows: '3.8M', tags: ['core', 'pci'],
    connection: 'SF_Codex', updated: '2026-05-04 18:00',
    desc: 'Payment transactions including method, gateway, and settlement status.',
    issues: [
      { rule: 'Payment Amount NOT NULL', severity: 'critical', detail: '1,482,000 records (39%) have NULL payment_amount — column was dropped in last migration', impact: 'Finance reconciliation completely broken; revenue reports understated by ~$12M' },
      { rule: 'Schema Change Detected', severity: 'critical', detail: 'Column "amount_usd" removed 2026-05-04 18:00 — 2 downstream dbt models broken', impact: 'revenue_by_channel view returning stale data; BI dashboards showing 0 for USD amounts' },
      { rule: 'Duplicate Transaction IDs', severity: 'critical', detail: '3,200 duplicate transaction_id values detected', impact: 'Double-counting payments in settlement reports; audit risk' },
      { rule: 'Freshness Check', severity: 'warning', detail: 'Last updated 18h ago — SLA is 6h', impact: 'Same-day payment reconciliation not possible' },
    ],
  },
  {
    id: 'c5', name: 'web_sessions', schema: 'CODEX.ANALYTICS', type: 'Table', domain: 'Marketing',
    owner: 'Priya M.', score: 88, columns: 31, rows: '9.5M', tags: ['clickstream'],
    connection: 'SF_Codex', updated: '2026-05-05 06:00',
    desc: 'Web session events from GA4 with UTM attribution and funnel steps.',
    issues: [
      { rule: 'Session Duration Check', severity: 'warning', detail: '190,000 sessions (2%) have duration > 8h — likely bot traffic or tab abandonment', impact: 'Inflates average session duration metric by ~12 min' },
      { rule: 'UTM Source Completeness', severity: 'info', detail: '4% of sessions missing utm_source — expected for direct traffic', impact: 'Minor attribution gap — within acceptable threshold' },
      { rule: 'User ID Format', severity: 'info', detail: 'All user IDs match GA4 UUID format', impact: 'No impact' },
    ],
  },
  {
    id: 'c6', name: 'dim_products', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Catalog',
    owner: 'Anil K.', score: 91, columns: 18, rows: '45K', tags: ['catalog'],
    connection: 'SF_Codex', updated: '2026-05-03 14:00',
    desc: 'Product catalog with SKU, category hierarchy, pricing, and availability.',
    issues: [
      { rule: 'SKU Uniqueness', severity: 'info', detail: 'All 45K SKUs are unique', impact: 'No impact' },
      { rule: 'Price > 0', severity: 'info', detail: 'All products have valid positive price', impact: 'No impact' },
      { rule: 'Category Completeness', severity: 'warning', detail: '420 products (0.9%) missing sub-category — recently added SKUs', impact: 'Faceted search returns incomplete results for sub-category filters' },
    ],
  },
  {
    id: 'c7', name: 'revenue_by_channel', schema: 'CODEX.ANALYTICS', type: 'View', domain: 'Finance',
    owner: 'Bhaskar R.', score: 97, columns: 8, rows: '—', tags: ['aggregated', 'core'],
    connection: 'SF_Codex', updated: '2026-05-05 12:00',
    desc: 'Aggregated revenue view grouped by sales channel and date.',
    issues: [
      { rule: 'Aggregation Consistency', severity: 'info', detail: 'View totals match source fact_orders within 0.01%', impact: 'No impact' },
      { rule: 'Freshness', severity: 'info', detail: 'Refreshed 12 min ago — up to date', impact: 'No impact' },
    ],
  },
  {
    id: 'c8', name: 'customer_ltv', schema: 'CODEX.ML', type: 'ML Table', domain: 'Marketing',
    owner: 'Priya M.', score: 84, columns: 12, rows: '1.1M', tags: ['ml', 'customer'],
    connection: 'SF_Codex', updated: '2026-05-05 02:00',
    desc: 'Customer lifetime value predictions from XGBoost model, refreshed daily.',
    issues: [
      { rule: 'LTV Score Range', severity: 'warning', detail: '8,200 customers (0.7%) have LTV score > $50K — statistical outliers from data leakage', impact: 'High-value segment over-inflated; paid acquisition targeting skewed' },
      { rule: 'Prediction Coverage', severity: 'warning', detail: '32,000 customers (2.9%) have no LTV prediction — new sign-ups in last 24h', impact: 'New customers excluded from personalization until next daily refresh' },
      { rule: 'Model Staleness', severity: 'info', detail: 'Model retrained 6 days ago — within 7-day SLA', impact: 'No impact' },
    ],
  },
  {
    id: 'c9', name: 'fact_returns', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Operations',
    owner: 'Rajan S.', score: 79, columns: 16, rows: '290K', tags: ['ops'],
    connection: 'SF_Codex', updated: '2026-05-05 10:00',
    desc: 'Return and refund transactions with reason codes and SLA tracking.',
    issues: [
      { rule: 'Return Reason Code Valid', severity: 'critical', detail: '6,800 records (2.3%) have reason_code "UNKNOWN" — mapping table outdated', impact: 'Operations team cannot categorise returns; SLA tracking broken for these cases' },
      { rule: 'Refund Amount ≤ Order Amount', severity: 'critical', detail: '140 records have refund_amount > original order_amount — data entry error', impact: 'Finance overpaying refunds — estimated excess ~$28K' },
      { rule: 'SLA Breach Detection', severity: 'warning', detail: '920 returns exceeded 5-day resolution SLA', impact: 'Customer satisfaction risk; SLA penalty exposure' },
    ],
  },
]

function scoreColor(s: number) { return s >= 90 ? '#16a34a' : s >= 80 ? '#ca8a04' : '#dc2626' }
function scoreBg(s: number)    { return s >= 90 ? '#f0fdf4'  : s >= 80 ? '#fefce8'  : '#fee2e2' }
function statusLabel(s: number) { return s >= 90 ? 'Healthy' : s >= 80 ? 'At Risk' : 'Critical' }

const sevCfg = {
  critical: { bg: '#fee2e2', color: '#dc2626', dot: '#dc2626', label: 'Critical' },
  warning:  { bg: '#fef9c3', color: '#ca8a04', dot: '#ca8a04', label: 'Warning'  },
  info:     { bg: '#f0f9ff', color: '#0284c7', dot: '#0284c7', label: 'Passing'  },
}

type Filter = 'all' | 'healthy' | 'at-risk' | 'critical'

export default function CatalogPage() {
  const [search, setSearch]   = useState('')
  const [domain, setDomain]   = useState('all')
  const [filter, setFilter]   = useState<Filter>('all')
  const [selected, setSelected] = useState<Asset | null>(null)

  const domains = ['all', ...Array.from(new Set(assets.map(a => a.domain)))]

  const healthy  = assets.filter(a => a.score >= 90)
  const atRisk   = assets.filter(a => a.score >= 80 && a.score < 90)
  const critical = assets.filter(a => a.score < 80)

  const filtered = assets.filter(a => {
    if (filter === 'healthy'  && a.score < 90) return false
    if (filter === 'at-risk'  && (a.score < 80 || a.score >= 90)) return false
    if (filter === 'critical' && a.score >= 80) return false
    if (domain !== 'all' && a.domain !== domain) return false
    if (search && !a.name.includes(search) && !a.desc.toLowerCase().includes(search.toLowerCase()) && !a.tags.some(t => t.includes(search))) return false
    return true
  })

  const statCards = [
    { key: 'all'      as Filter, label: 'Total Assets',   value: assets.length,    icon: '📦', color: '#475569', border: '#e2e8f0', activeBg: '#f8fafc'  },
    { key: 'healthy'  as Filter, label: 'Healthy (≥90)',  value: healthy.length,   icon: '✅', color: '#16a34a', border: '#bbf7d0', activeBg: '#f0fdf4'  },
    { key: 'at-risk'  as Filter, label: 'At Risk (80–89)',value: atRisk.length,    icon: '⚠️', color: '#ca8a04', border: '#fde68a', activeBg: '#fefce8'  },
    { key: 'critical' as Filter, label: 'Critical (<80)', value: critical.length,  icon: '❌', color: '#dc2626', border: '#fca5a5', activeBg: '#fee2e2'  },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: selected ? '1100px' : '1300px', display: 'flex', gap: '24px' }}>
      {/* Left panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Catalog</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            {filtered.length} of {assets.length} assets · {filter !== 'all' ? statCards.find(s => s.key === filter)?.label : 'all domains'}
          </p>
        </div>

        {/* Clickable stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
          {statCards.map(s => {
            const active = filter === s.key
            return (
              <button key={s.key} onClick={() => setFilter(active ? 'all' : s.key)} style={{
                background: active ? s.activeBg : '#fff',
                border: `2px solid ${active ? s.border : '#ebe8df'}`,
                borderRadius: '12px', padding: '16px 20px', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s',
                boxShadow: active ? `0 0 0 3px ${s.border}40` : 'none',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: active ? s.color : '#1a1a1a' }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: active ? s.color : '#64748b', fontWeight: active ? 600 : 400, marginTop: '2px' }}>{s.label}</div>
                {active && <div style={{ fontSize: '10px', color: s.color, marginTop: '4px', fontWeight: 600 }}>▲ Filtered</div>}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets, tags, descriptions…"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }} />
          <select value={domain} onChange={e => setDomain(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
            {domains.map(d => <option key={d} value={d}>{d === 'all' ? 'All Domains' : d}</option>)}
          </select>
        </div>

        {/* Asset cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 && (
            <div style={{ background: '#fff', border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              No assets match the current filter
            </div>
          )}
          {filtered.map(a => {
            const isSelected = selected?.id === a.id
            const criticalCount  = a.issues.filter(i => i.severity === 'critical').length
            const warningCount   = a.issues.filter(i => i.severity === 'warning').length
            return (
              <div key={a.id} onClick={() => setSelected(isSelected ? null : a)} style={{
                background: '#fff',
                border: `1.5px solid ${isSelected ? '#6366f1' : a.score < 80 ? '#fca5a5' : a.score < 90 ? '#fde68a' : '#d1fae5'}`,
                borderRadius: '14px', padding: '18px 20px', cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s',
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '14px' }}>{a.name}</span>
                      <span style={{ background: scoreBg(a.score), color: scoreColor(a.score), fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>{statusLabel(a.score)}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{a.schema} · {a.type} · {a.domain}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: scoreColor(a.score), lineHeight: 1 }}>{a.score}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>quality score</div>
                  </div>
                </div>

                <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '12px', lineHeight: '1.55' }}>{a.desc}</div>

                {/* Issue summary pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {criticalCount > 0 && (
                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      ❌ {criticalCount} critical issue{criticalCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span style={{ background: '#fef9c3', color: '#ca8a04', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      ⚠️ {warningCount} warning{warningCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {criticalCount === 0 && warningCount === 0 && (
                    <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                      ✓ All checks passing
                    </span>
                  )}
                  {a.tags.map(t => <span key={t} style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '20px', fontSize: '11px' }}>{t}</span>)}
                </div>

                {/* Inline issues when selected */}
                {isSelected && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Check Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {a.issues.map((issue, idx) => {
                        const cfg = sevCfg[issue.severity]
                        return (
                          <div key={idx} style={{ background: cfg.bg, borderRadius: '10px', padding: '12px 14px', border: `1px solid ${cfg.color}30` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: '12.5px', color: cfg.color }}>{cfg.label}</span>
                              <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#1a1a1a', flex: 1 }}>{issue.rule}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#374151', marginBottom: '5px', paddingLeft: '15px' }}>{issue.detail}</div>
                            <div style={{ fontSize: '11.5px', color: '#6b7280', paddingLeft: '15px' }}>
                              <strong style={{ color: '#374151' }}>Impact:</strong> {issue.impact}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Metadata footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
                      {[['Owner', `👤 ${a.owner}`], ['Rows / Cols', `${a.rows} · ${a.columns} cols`], ['Last Updated', a.updated]].map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                          <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', borderTop: '1px solid #f3f1ea', paddingTop: '10px', marginTop: isSelected ? '12px' : '0' }}>
                  <span>🔗 {a.connection}</span>
                  <span style={{ color: '#6366f1', fontWeight: 500 }}>{isSelected ? '▲ Click to collapse' : '▼ Click for details'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
