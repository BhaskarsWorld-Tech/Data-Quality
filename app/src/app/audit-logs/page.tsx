'use client'
import { useState } from 'react'

const logs = [
  { id: 'u1', user: 'Bhaskar R.', action: 'Connection Created', resource: 'SF_Codex (Snowflake)', ip: '192.168.1.10', ts: '2026-05-05 03:17', category: 'connection', result: 'success' },
  { id: 'u2', user: 'Bhaskar R.', action: 'Connection Tested', resource: 'SF_Codex', ip: '192.168.1.10', ts: '2026-05-05 03:18', category: 'connection', result: 'success' },
  { id: 'u3', user: 'Priya M.', action: 'Rule Created', resource: 'Customer Email Format (dim_customers)', ip: '10.0.0.25', ts: '2026-05-04 14:30', category: 'rule', result: 'success' },
  { id: 'u4', user: 'Bhaskar R.', action: 'Rule Updated', resource: 'Orders NOT NULL Check', ip: '192.168.1.10', ts: '2026-05-04 11:00', category: 'rule', result: 'success' },
  { id: 'u5', user: 'Rajan S.', action: 'Schedule Paused', resource: 'Inventory Snapshot Check', ip: '10.0.0.41', ts: '2026-05-04 09:15', category: 'schedule', result: 'success' },
  { id: 'u6', user: 'System', action: 'Alert Fired', resource: 'Critical Quality Drop → fact_payments', ip: 'internal', ts: '2026-05-04 18:00', category: 'alert', result: 'success' },
  { id: 'u7', user: 'Anil K.', action: 'Login', resource: 'Web Console', ip: '10.0.0.88', ts: '2026-05-04 08:30', category: 'auth', result: 'success' },
  { id: 'u8', user: 'Unknown', action: 'Login Failed', resource: 'Web Console', ip: '203.0.113.42', ts: '2026-05-03 23:14', category: 'auth', result: 'failed' },
  { id: 'u9', user: 'Bhaskar R.', action: 'Report Generated', resource: 'Weekly Quality Summary', ip: '192.168.1.10', ts: '2026-05-03 09:00', category: 'report', result: 'success' },
  { id: 'u10', user: 'Priya M.', action: 'Contract Created', resource: 'Customers → Marketing Platform', ip: '10.0.0.25', ts: '2026-05-02 15:45', category: 'contract', result: 'success' },
  { id: 'u11', user: 'Bhaskar R.', action: 'SLA Updated', resource: 'Payment Reconciliation SLA', ip: '192.168.1.10', ts: '2026-05-02 10:00', category: 'sla', result: 'success' },
  { id: 'u12', user: 'System', action: 'Anomaly Detected', resource: 'fact_orders volume spike', ip: 'internal', ts: '2026-05-05 14:22', category: 'anomaly', result: 'success' },
]

const catColor: Record<string, { bg: string; color: string }> = {
  connection: { bg: '#eff6ff', color: '#2563eb' },
  rule: { bg: '#f5f3ff', color: '#7c3aed' },
  schedule: { bg: '#f0fdf4', color: '#16a34a' },
  alert: { bg: '#fee2e2', color: '#dc2626' },
  auth: { bg: '#fff7ed', color: '#ea580c' },
  report: { bg: '#fef9c3', color: '#ca8a04' },
  contract: { bg: '#f0fdfa', color: '#0d9488' },
  sla: { bg: '#fdf4ff', color: '#a21caf' },
  anomaly: { bg: '#fff1f2', color: '#e11d48' },
}

export default function AuditLogsPage() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const categories = ['all', ...Array.from(new Set(logs.map(l => l.category)))]
  const filtered = logs.filter(l =>
    (category === 'all' || l.category === category) &&
    (search === '' || l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.resource.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Audit Logs</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Complete record of all user and system actions — {logs.length} events in the last 7 days</p>
        </div>
        <button style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#475569', cursor: 'pointer' }}>⬇ Export Log</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Events', value: logs.length, icon: '📋' }, { label: 'Users Active', value: new Set(logs.filter(l => l.user !== 'System').map(l => l.user)).size, icon: '👥' }, { label: 'System Events', value: logs.filter(l => l.user === 'System').length, icon: '⚙️' }, { label: 'Failed Actions', value: logs.filter(l => l.result === 'failed').length, icon: '⚠️' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action, resource…" style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }} />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
              {['Timestamp','User','Category','Action','Resource','IP Address','Result'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => {
              const cc = catColor[l.category] || { bg: '#f8fafc', color: '#64748b' }
              return (
                <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f1ea' : 'none' }}>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '11.5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.ts}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600, color: l.user === 'System' ? '#6366f1' : '#1a1a1a', fontSize: '12.5px' }}>{l.user}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ ...cc, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{l.category}</span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontWeight: 500 }}>{l.action}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', maxWidth: '260px', fontSize: '12.5px' }}>{l.resource}</td>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11.5px' }}>{l.ip}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: l.result === 'success' ? '#f0fdf4' : '#fee2e2', color: l.result === 'success' ? '#16a34a' : '#dc2626', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{l.result}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
