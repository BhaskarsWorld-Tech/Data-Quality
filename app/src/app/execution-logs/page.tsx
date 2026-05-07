'use client'
import { useState } from 'react'

const logs = [
  { id: 'l1', rule: 'Orders NOT NULL Check', dataset: 'fact_orders', connection: 'SF_Codex', status: 'passed', score: 100, checked: '4200000', failed: '0', duration: '12s', ts: '2026-05-05 17:00:01', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l2', rule: 'Revenue > 0 Validity', dataset: 'fact_orders', connection: 'SF_Codex', status: 'passed', score: 99.8, checked: '4200000', failed: '8400', duration: '18s', ts: '2026-05-05 17:00:13', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l3', rule: 'Customer Email Format', dataset: 'dim_customers', connection: 'SF_Codex', status: 'failed', score: 80, checked: '1100000', failed: '220000', duration: '9s', ts: '2026-05-05 12:00:05', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l4', rule: 'Payment Null Check', dataset: 'fact_payments', connection: 'SF_Codex', status: 'failed', score: 61, checked: '3800000', failed: '1482000', duration: '1m 2s', ts: '2026-05-05 05:30:10', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l5', rule: 'Inventory Stock ≥ 0', dataset: 'fact_inventory', connection: 'SF_Codex', status: 'passed', score: 100, checked: '820000', failed: '0', duration: '7s', ts: '2026-05-05 16:00:03', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l6', rule: 'Orders Volume Anomaly', dataset: 'fact_orders', connection: 'SF_Codex', status: 'failed', score: 0, checked: '1', failed: '1', duration: '3s', ts: '2026-05-05 14:22:00', trigger: 'Anomaly Detector', runBy: 'system' },
  { id: 'l7', rule: 'Session Duration Check', dataset: 'web_sessions', connection: 'SF_Codex', status: 'passed', score: 98, checked: '9500000', failed: '190000', duration: '8s', ts: '2026-05-05 17:00:01', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l8', rule: 'Product SKU Unique', dataset: 'dim_products', connection: 'SF_Codex', status: 'passed', score: 100, checked: '45000', failed: '0', duration: '2s', ts: '2026-05-05 14:00:01', trigger: 'Manual', runBy: 'Bhaskar R.' },
  { id: 'l9', rule: 'Customer Consent Flag', dataset: 'dim_customers', connection: 'SF_Codex', status: 'warning', score: 87, checked: '1100000', failed: '143000', duration: '11s', ts: '2026-05-05 12:00:16', trigger: 'Scheduled', runBy: 'scheduler' },
  { id: 'l10', rule: 'Orders Freshness Check', dataset: 'fact_orders', connection: 'SF_Codex', status: 'passed', score: 100, checked: '1', failed: '0', duration: '1s', ts: '2026-05-05 06:00:01', trigger: 'Scheduled', runBy: 'scheduler' },
]

const statStyle: Record<string, { bg: string; color: string }> = {
  passed: { bg: '#f0fdf4', color: '#16a34a' },
  failed: { bg: '#fee2e2', color: '#dc2626' },
  warning: { bg: '#fefce8', color: '#ca8a04' },
}

export default function ExecutionLogsPage() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = logs.filter(l =>
    (status === 'all' || l.status === status) &&
    (search === '' || l.rule.toLowerCase().includes(search.toLowerCase()) || l.dataset.includes(search))
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1400px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Execution Logs</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Full history of every quality check run · {logs.length} runs today</p>
        </div>
        <button style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#475569', cursor: 'pointer' }}>⬇ Export CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Runs (24h)', value: logs.length, icon: '🔄' }, { label: 'Passed', value: logs.filter(l => l.status === 'passed').length, icon: '✅' }, { label: 'Failed', value: logs.filter(l => l.status === 'failed').length, icon: '❌' }, { label: 'Warnings', value: logs.filter(l => l.status === 'warning').length, icon: '⚠️' }, { label: 'Avg Score', value: Math.round(logs.reduce((a, l) => a + l.score, 0) / logs.length) + '%', icon: '📊' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by rule or dataset…" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#475569' }}>
          <option value="all">All Statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="warning">Warning</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
              {['Timestamp','Rule','Dataset','Connection','Status','Score','Checked','Failed','Duration','Trigger','Run By'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => {
              const ss = statStyle[l.status]
              const scoreColor = l.score >= 95 ? '#16a34a' : l.score >= 80 ? '#ca8a04' : '#dc2626'
              return (
                <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f1ea' : 'none' }}>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '11.5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.ts}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1a1a1a', maxWidth: '200px' }}>{l.rule}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: '12.5px' }}>{l.dataset}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{l.connection}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ ...ss, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{l.status}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: scoreColor }}>{l.score}%</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{parseInt(l.checked).toLocaleString()}</td>
                  <td style={{ padding: '11px 14px', color: parseInt(l.failed) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>{parseInt(l.failed).toLocaleString()}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{l.duration}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{l.trigger}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: '12px' }}>{l.runBy}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No logs match your filters</div>}
      </div>
    </div>
  )
}
