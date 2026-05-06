'use client'
import { useState } from 'react'

const anomalies = [
  { id: 'a1', table: 'fact_orders', column: 'revenue', type: 'Volume Spike', severity: 'critical', detected: '2026-05-05 14:22', delta: '+340%', description: 'Row count increased 340% vs 7-day baseline', status: 'open', connection: 'SF_Codex', domain: 'Finance' },
  { id: 'a2', table: 'dim_customers', column: 'email', type: 'Null Rate', severity: 'high', detected: '2026-05-05 11:05', delta: '+18%', description: 'Null email rate jumped from 2% to 20%', status: 'investigating', connection: 'SF_Codex', domain: 'Marketing' },
  { id: 'a3', table: 'fact_inventory', column: 'stock_qty', type: 'Value Drift', severity: 'high', detected: '2026-05-04 22:30', delta: '-45%', description: 'Mean stock_qty dropped significantly outside normal range', status: 'open', connection: 'SF_Codex', domain: 'Supply Chain' },
  { id: 'a4', table: 'fact_payments', column: 'amount_usd', type: 'Schema Change', severity: 'critical', detected: '2026-05-04 18:00', delta: 'REMOVED', description: 'Column "amount_usd" removed — breaking downstream models', status: 'open', connection: 'SF_Codex', domain: 'Finance' },
  { id: 'a5', table: 'web_sessions', column: 'session_duration', type: 'Distribution Shift', severity: 'medium', detected: '2026-05-03 09:15', delta: '+92%', description: 'P95 session duration shifted from 8min to 15min', status: 'resolved', connection: 'SF_Codex', domain: 'Marketing' },
  { id: 'a6', table: 'dim_products', column: 'price', type: 'Freshness', severity: 'medium', detected: '2026-05-03 06:00', delta: '36h late', description: 'Table not updated in 36 hours — expected every 6 hours', status: 'resolved', connection: 'SF_Codex', domain: 'Catalog' },
  { id: 'a7', table: 'fact_returns', column: 'return_reason', type: 'Cardinality', severity: 'low', detected: '2026-05-02 14:00', delta: '+15 values', description: '15 new unexpected enum values appeared in return_reason', status: 'resolved', connection: 'SF_Codex', domain: 'Operations' },
]

const sevStyle: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fee2e2', color: '#dc2626' },
  high: { bg: '#fff7ed', color: '#ea580c' },
  medium: { bg: '#fefce8', color: '#ca8a04' },
  low: { bg: '#f0fdf4', color: '#16a34a' },
}
const statStyle: Record<string, { bg: string; color: string }> = {
  open: { bg: '#fee2e2', color: '#dc2626' },
  investigating: { bg: '#fff7ed', color: '#ea580c' },
  resolved: { bg: '#f0fdf4', color: '#16a34a' },
}
const typeColor: Record<string, string> = {
  'Volume Spike': '#6366f1', 'Null Rate': '#ec4899', 'Value Drift': '#f59e0b',
  'Schema Change': '#ef4444', 'Distribution Shift': '#8b5cf6', 'Freshness': '#0ea5e9', 'Cardinality': '#14b8a6',
}

export default function AnomaliesPage() {
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<typeof anomalies[0] | null>(null)

  const filtered = anomalies.filter(a =>
    (severity === 'all' || a.severity === severity) &&
    (status === 'all' || a.status === status) &&
    (search === '' || a.table.includes(search) || a.type.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))
  )

  const critical = anomalies.filter(a => a.severity === 'critical').length
  const open = anomalies.filter(a => a.status === 'open').length

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Anomalies</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>AI-detected data anomalies across all monitored datasets</p>
        </div>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', color: '#dc2626', fontWeight: 600 }}>
          ⚡ {critical} critical · {open} open
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Detected', value: anomalies.length, icon: '📡', color: '#6366f1' }, { label: 'Critical', value: critical, icon: '🔴', color: '#dc2626' }, { label: 'Open', value: open, icon: '⚠️', color: '#ea580c' }, { label: 'Resolved (7d)', value: anomalies.filter(a => a.status === 'resolved').length, icon: '✅', color: '#16a34a' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anomalies…" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', flex: 1, background: '#fafaf9', color: '#0f172a' }} />
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
          <option value="all">All Severities</option>
          {['critical','high','medium','low'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
          <option value="all">All Statuses</option>
          {['open','investigating','resolved'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
              {['Severity','Type','Table · Column','Description','Delta','Detected','Status',''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const s = sevStyle[a.severity]
              const st = statStyle[a.status]
              const tc = typeColor[a.type] || '#64748b'
              return (
                <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f1ea' : 'none', background: selected?.id === a.id ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ ...s, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{a.severity}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: `${tc}18`, color: tc, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{a.type}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{a.table}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{a.column} · {a.domain}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#475569', maxWidth: '240px' }}>{a.description}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#dc2626', fontFamily: 'monospace', fontSize: '12px' }}>{a.delta}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '12px' }}>{a.detected}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ ...st, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{a.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => setSelected(selected?.id === a.id ? null : a)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '11.5px', cursor: 'pointer' }}>Details</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No anomalies match your filters</div>}
      </div>

      {selected && (
        <div style={{ marginTop: '16px', background: '#fff', border: '1px solid #93c5fd', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>Anomaly Detail — {selected.table}.{selected.column}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '14px' }}>
            {[['Connection', selected.connection],['Domain', selected.domain],['Type', selected.type],['Severity', selected.severity],['Status', selected.status],['Detected', selected.detected],['Delta', selected.delta],['Table', selected.table],['Column', selected.column]].map(([k, v]) => (
              <div key={k} style={{ background: '#fafaf9', borderRadius: '8px', padding: '10px 14px', border: '1px solid #ebe8df' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#78350f' }}>
            <strong>Description:</strong> {selected.description}
          </div>
        </div>
      )}
    </div>
  )
}
