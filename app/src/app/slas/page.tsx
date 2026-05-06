'use client'
import { useState } from 'react'

const slas = [
  { id: 's1', name: 'Orders Freshness', dataset: 'fact_orders', type: 'Freshness', target: '< 4h delay', current: '1.2h', adherence: 99, status: 'healthy', owner: 'Bhaskar R.', connection: 'SF_Codex', domain: 'Finance', breaches: 0, trend: [99,100,99,100,100,99,99] },
  { id: 's2', name: 'Customer Data Quality', dataset: 'dim_customers', type: 'Quality Score', target: '≥ 90%', current: '81%', adherence: 72, status: 'breached', owner: 'Priya M.', connection: 'SF_Codex', domain: 'Marketing', breaches: 3, trend: [95,93,90,87,83,81,81] },
  { id: 's3', name: 'Payment Reconciliation', dataset: 'fact_payments', type: 'Accuracy', target: '< 0.01% variance', current: '0.04%', adherence: 61, status: 'breached', owner: 'Bhaskar R.', connection: 'SF_Codex', domain: 'Finance', breaches: 5, trend: [98,97,85,75,65,62,61] },
  { id: 's4', name: 'Inventory Refresh Rate', dataset: 'fact_inventory', type: 'Freshness', target: '< 6h delay', current: '5.4h', adherence: 91, status: 'at-risk', owner: 'Rajan S.', connection: 'SF_Codex', domain: 'Supply Chain', breaches: 1, trend: [98,97,96,94,93,92,91] },
  { id: 's5', name: 'Web Sessions Completeness', dataset: 'web_sessions', type: 'Completeness', target: '≥ 99% non-null', current: '99.4%', adherence: 100, status: 'healthy', owner: 'Priya M.', connection: 'SF_Codex', domain: 'Marketing', breaches: 0, trend: [100,100,100,99,100,100,100] },
  { id: 's6', name: 'Product Catalog Validity', dataset: 'dim_products', type: 'Validity', target: '≥ 95% valid SKUs', current: '98.1%', adherence: 100, status: 'healthy', owner: 'Anil K.', connection: 'SF_Codex', domain: 'Catalog', breaches: 0, trend: [100,100,100,100,99,100,100] },
]

const statStyle: Record<string, { bg: string; color: string; dot: string }> = {
  healthy: { bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  'at-risk': { bg: '#fff7ed', color: '#ea580c', dot: '#ea580c' },
  breached: { bg: '#fee2e2', color: '#dc2626', dot: '#dc2626' },
}

function MiniTrend({ data, color }: { data: number[]; color: string }) {
  const max = 100, min = Math.min(...data) - 2
  const w = 80, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`)
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SLAsPage() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<typeof slas[0] | null>(null)

  const filtered = slas.filter(s => filter === 'all' || s.status === filter)
  const overall = Math.round(slas.reduce((acc, s) => acc + s.adherence, 0) / slas.length)

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>SLA Management</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Track service-level agreements across all data assets — {overall}% overall adherence</p>
        </div>
        <button style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ New SLA</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Overall Adherence', value: overall + '%', icon: '📊', color: overall >= 90 ? '#16a34a' : '#ea580c' }, { label: 'Healthy', value: slas.filter(s => s.status === 'healthy').length, icon: '✅', color: '#16a34a' }, { label: 'At Risk', value: slas.filter(s => s.status === 'at-risk').length, icon: '⚠️', color: '#ea580c' }, { label: 'Breached', value: slas.filter(s => s.status === 'breached').length, icon: '🚨', color: '#dc2626' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['all', 'healthy', 'at-risk', 'breached'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', borderColor: filter === f ? '#2563eb' : '#e2e8f0', background: filter === f ? '#dbeafe' : '#fff', color: filter === f ? '#2563eb' : '#64748b', fontSize: '12.5px', fontWeight: filter === f ? 600 : 400, cursor: 'pointer' }}>
            {f === 'all' ? 'All SLAs' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
              {['SLA Name', 'Dataset', 'Type', 'Target', 'Current', 'Adherence', '7-day Trend', 'Breaches', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const ss = statStyle[s.status]
              const adColor = s.adherence >= 95 ? '#16a34a' : s.adherence >= 80 ? '#ca8a04' : '#dc2626'
              return (
                <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f1ea' : 'none', background: selected?.id === s.id ? '#f0f9ff' : 'transparent', cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1a1a1a' }}>{s.name}</td>
                  <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12.5px' }}>{s.dataset}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{s.type}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>{s.target}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: adColor, fontFamily: 'monospace', fontSize: '12px' }}>{s.current}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '5px', background: '#f1f5f9', borderRadius: '3px', minWidth: '60px' }}>
                        <div style={{ height: '100%', width: `${s.adherence}%`, background: adColor, borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: adColor, minWidth: '36px' }}>{s.adherence}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <MiniTrend data={s.trend} color={adColor} />
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: s.breaches > 0 ? '#dc2626' : '#16a34a', textAlign: 'center' }}>{s.breaches}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ ...ss, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />{s.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{s.domain}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ marginTop: '16px', background: '#fff', border: '1px solid #93c5fd', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>{selected.name}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
            {[['Connection', selected.connection], ['Domain', selected.domain], ['Owner', selected.owner], ['Breaches (30d)', String(selected.breaches)], ['Target', selected.target], ['Current', selected.current], ['Adherence', selected.adherence + '%'], ['Type', selected.type]].map(([k, v]) => (
              <div key={k} style={{ background: '#fafaf9', borderRadius: '8px', padding: '10px 14px', border: '1px solid #ebe8df' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
