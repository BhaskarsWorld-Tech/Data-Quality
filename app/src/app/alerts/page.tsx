'use client'
import { useState } from 'react'

const alertRules = [
  { id: 'ar1', name: 'Critical Quality Drop', condition: 'Score < 70%', datasets: 'All', channel: 'Slack + Email', severity: 'critical', enabled: true, triggered: 3, lastFired: '2026-05-05 14:22' },
  { id: 'ar2', name: 'Schema Change Detected', condition: 'Column added/removed', datasets: 'fact_*, dim_*', channel: 'PagerDuty', severity: 'critical', enabled: true, triggered: 1, lastFired: '2026-05-04 18:00' },
  { id: 'ar3', name: 'Freshness SLA Breach', condition: 'Delay > 6h', datasets: 'All', channel: 'Slack', severity: 'high', enabled: true, triggered: 2, lastFired: '2026-05-03 06:00' },
  { id: 'ar4', name: 'High Null Rate', condition: 'Null rate > 10%', datasets: 'dim_customers, fact_orders', channel: 'Email', severity: 'high', enabled: true, triggered: 1, lastFired: '2026-05-05 11:05' },
  { id: 'ar5', name: 'Volume Anomaly', condition: 'Row count ±50% baseline', datasets: 'All', channel: 'Slack', severity: 'medium', enabled: true, triggered: 1, lastFired: '2026-05-05 14:22' },
  { id: 'ar6', name: 'Weekly Summary Report', condition: 'Every Sunday 9 AM', datasets: 'All', channel: 'Email', severity: 'info', enabled: false, triggered: 0, lastFired: '2026-04-28 09:00' },
]

const recentAlerts = [
  { id: 'a1', rule: 'Critical Quality Drop', dataset: 'fact_payments', severity: 'critical', message: 'Quality score dropped to 61% — 5 rules failing', channel: 'Slack + Email', ts: '2026-05-05 14:22', ack: false },
  { id: 'a2', rule: 'Schema Change Detected', dataset: 'fact_payments', severity: 'critical', message: 'Column "amount_usd" removed — 2 downstream models affected', channel: 'PagerDuty', ts: '2026-05-04 18:00', ack: false },
  { id: 'a3', rule: 'High Null Rate', dataset: 'dim_customers', severity: 'high', message: 'Email null rate jumped from 2% to 20%', channel: 'Email', ts: '2026-05-05 11:05', ack: true },
  { id: 'a4', rule: 'Freshness SLA Breach', dataset: 'dim_products', severity: 'high', message: 'Table not refreshed in 36 hours — expected every 6h', channel: 'Slack', ts: '2026-05-03 06:00', ack: true },
  { id: 'a5', rule: 'Volume Anomaly', dataset: 'fact_orders', severity: 'medium', message: 'Row count increased 340% vs 7-day baseline', channel: 'Slack', ts: '2026-05-05 14:22', ack: false },
]

const sevStyle: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fee2e2', color: '#dc2626' },
  high: { bg: '#fff7ed', color: '#ea580c' },
  medium: { bg: '#fefce8', color: '#ca8a04' },
  info: { bg: '#f0f9ff', color: '#0284c7' },
}

export default function AlertsPage() {
  const [rules, setRules] = useState(alertRules)
  const [alerts, setAlerts] = useState(recentAlerts)
  const [tab, setTab] = useState<'recent' | 'rules'>('recent')

  const unacked = alerts.filter(a => !a.ack).length

  function toggleRule(id: string) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }
  function ack(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ack: true } : a))
  }
  function ackAll() {
    setAlerts(prev => prev.map(a => ({ ...a, ack: true })))
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Alerts</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>{alerts.filter(a => !a.ack).length} unacknowledged · {rules.filter(r => r.enabled).length} active alert rules</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unacked > 0 && <button onClick={ackAll} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#475569', cursor: 'pointer' }}>✓ Ack All ({unacked})</button>}
          <button style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ New Alert Rule</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Unacknowledged', value: alerts.filter(a => !a.ack).length, icon: '🔔', color: '#dc2626' }, { label: 'Total (24h)', value: alerts.length, icon: '📊', color: '#1a1a1a' }, { label: 'Alert Rules', value: rules.length, icon: '⚙️', color: '#1a1a1a' }, { label: 'Active Rules', value: rules.filter(r => r.enabled).length, icon: '▶️', color: '#16a34a' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f8fafc', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['recent', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1a1a1a' : '#64748b', fontWeight: tab === t ? 600 : 400, fontSize: '13px', cursor: 'pointer', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'recent' ? 'Recent Alerts' : 'Alert Rules'}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map(a => {
            const ss = sevStyle[a.severity]
            return (
              <div key={a.id} style={{ background: '#fff', border: `1px solid ${!a.ack ? '#fca5a5' : '#ebe8df'}`, borderRadius: '12px', padding: '16px 20px', opacity: a.ack ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ ...ss, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{a.severity}</span>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a' }}>{a.rule}</span>
                      {a.ack && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 600 }}>✓ Acknowledged</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>{a.message}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                      <span>Dataset: <strong style={{ color: '#475569' }}>{a.dataset}</strong></span>
                      <span>Channel: <strong style={{ color: '#475569' }}>{a.channel}</strong></span>
                      <span>{a.ts}</span>
                    </div>
                  </div>
                  {!a.ack && (
                    <button onClick={() => ack(a.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '12px', cursor: 'pointer', flexShrink: 0, marginLeft: '16px' }}>
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'rules' && (
        <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
                {['Rule Name','Condition','Datasets','Channel','Severity','Triggered','Last Fired','Enabled'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => {
                const ss = sevStyle[r.severity]
                return (
                  <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? '1px solid #f3f1ea' : 'none' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1a1a1a' }}>{r.name}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', fontFamily: 'monospace', fontSize: '12px' }}>{r.condition}</td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{r.datasets}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>{r.channel}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ ...ss, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{r.severity}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: r.triggered > 0 ? '#dc2626' : '#16a34a', textAlign: 'center' }}>{r.triggered}</td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>{r.lastFired}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => toggleRule(r.id)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: r.enabled ? '#2563eb' : '#e2e8f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: '3px', left: r.enabled ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
