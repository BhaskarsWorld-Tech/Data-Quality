'use client'
import { useState } from 'react'

const assets = [
  { id: 'c1', name: 'fact_orders', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Finance', owner: 'Bhaskar R.', score: 94, columns: 28, rows: '4.2M', tags: ['core','revenue'], connection: 'SF_Codex', updated: '2026-05-05 12:00', desc: 'Central orders fact table with line-item revenue, discounts, and fulfillment status.' },
  { id: 'c2', name: 'dim_customers', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Marketing', owner: 'Priya M.', score: 81, columns: 19, rows: '1.1M', tags: ['pii','customer'], connection: 'SF_Codex', updated: '2026-05-05 08:00', desc: 'Customer master dimension with contact info, segment, and lifetime value.' },
  { id: 'c3', name: 'fact_inventory', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Supply Chain', owner: 'Rajan S.', score: 76, columns: 14, rows: '820K', tags: ['ops'], connection: 'SF_Codex', updated: '2026-05-04 23:00', desc: 'Real-time inventory levels, reorder points, and warehouse locations.' },
  { id: 'c4', name: 'fact_payments', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Finance', owner: 'Bhaskar R.', score: 62, columns: 22, rows: '3.8M', tags: ['core','pci'], connection: 'SF_Codex', updated: '2026-05-04 18:00', desc: 'Payment transactions including method, gateway, and settlement status.' },
  { id: 'c5', name: 'web_sessions', schema: 'CODEX.ANALYTICS', type: 'Table', domain: 'Marketing', owner: 'Priya M.', score: 88, columns: 31, rows: '9.5M', tags: ['clickstream'], connection: 'SF_Codex', updated: '2026-05-05 06:00', desc: 'Web session events from GA4 with UTM attribution and funnel steps.' },
  { id: 'c6', name: 'dim_products', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Catalog', owner: 'Anil K.', score: 91, columns: 18, rows: '45K', tags: ['catalog'], connection: 'SF_Codex', updated: '2026-05-03 14:00', desc: 'Product catalog with SKU, category hierarchy, pricing, and availability.' },
  { id: 'c7', name: 'revenue_by_channel', schema: 'CODEX.ANALYTICS', type: 'View', domain: 'Finance', owner: 'Bhaskar R.', score: 97, columns: 8, rows: '—', tags: ['aggregated','core'], connection: 'SF_Codex', updated: '2026-05-05 12:00', desc: 'Aggregated revenue view grouped by sales channel and date.' },
  { id: 'c8', name: 'customer_ltv', schema: 'CODEX.ML', type: 'ML Table', domain: 'Marketing', owner: 'Priya M.', score: 84, columns: 12, rows: '1.1M', tags: ['ml','customer'], connection: 'SF_Codex', updated: '2026-05-05 02:00', desc: 'Customer lifetime value predictions from XGBoost model, refreshed daily.' },
  { id: 'c9', name: 'fact_returns', schema: 'CODEX.PUBLIC', type: 'Table', domain: 'Operations', owner: 'Rajan S.', score: 79, columns: 16, rows: '290K', tags: ['ops'], connection: 'SF_Codex', updated: '2026-05-05 10:00', desc: 'Return and refund transactions with reason codes and SLA tracking.' },
]

function scoreColor(s: number) {
  if (s >= 90) return '#16a34a'
  if (s >= 80) return '#ca8a04'
  return '#dc2626'
}
function scoreBg(s: number) {
  if (s >= 90) return '#f0fdf4'
  if (s >= 80) return '#fefce8'
  return '#fee2e2'
}

export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [selected, setSelected] = useState<typeof assets[0] | null>(null)

  const domains = ['all', ...Array.from(new Set(assets.map(a => a.domain)))]
  const filtered = assets.filter(a =>
    (domain === 'all' || a.domain === domain) &&
    (search === '' || a.name.includes(search) || a.desc.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.includes(search)))
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Catalog</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>{assets.length} assets indexed from SF_Codex · all domains</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Assets', value: assets.length, icon: '📦' }, { label: 'Healthy (≥90)', value: assets.filter(a => a.score >= 90).length, icon: '✅' }, { label: 'At Risk (80-89)', value: assets.filter(a => a.score >= 80 && a.score < 90).length, icon: '⚠️' }, { label: 'Critical (<80)', value: assets.filter(a => a.score < 80).length, icon: '❌' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets, tags, descriptions…" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }} />
        <select value={domain} onChange={e => setDomain(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
          {domains.map(d => <option key={d} value={d}>{d === 'all' ? 'All Domains' : d}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px,1fr))', gap: '14px' }}>
        {filtered.map(a => (
          <div key={a.id} onClick={() => setSelected(selected?.id === a.id ? null : a)} style={{ background: '#fff', border: `1px solid ${selected?.id === a.id ? '#93c5fd' : '#ebe8df'}`, borderRadius: '12px', padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: selected?.id === a.id ? '0 0 0 3px #dbeafe' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '14px' }}>{a.name}</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{a.schema} · {a.type}</div>
              </div>
              <div style={{ background: scoreBg(a.score), color: scoreColor(a.score), fontWeight: 700, fontSize: '15px', padding: '4px 10px', borderRadius: '8px' }}>{a.score}</div>
            </div>
            <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '10px', lineHeight: '1.5' }}>{a.desc}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {a.tags.map(t => <span key={t} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500 }}>{t}</span>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', borderTop: '1px solid #f3f1ea', paddingTop: '10px' }}>
              <span>👤 {a.owner}</span>
              <span>📊 {a.rows} rows · {a.columns} cols</span>
              <span>🔗 {a.connection}</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: 'fixed', right: '24px', top: '80px', width: '320px', background: '#fff', border: '1px solid #93c5fd', borderRadius: '14px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>{selected.name}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[['Schema', selected.schema], ['Type', selected.type], ['Domain', selected.domain], ['Owner', selected.owner], ['Connection', selected.connection], ['Rows', selected.rows], ['Columns', String(selected.columns)], ['Last Updated', selected.updated], ['Quality Score', String(selected.score)]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid #f3f1ea' }}>
                <span style={{ color: '#94a3b8' }}>{k}</span>
                <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
