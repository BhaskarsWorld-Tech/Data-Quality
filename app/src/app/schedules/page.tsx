'use client'
import { useState } from 'react'

const schedules = [
  { id: 'sc1', name: 'Orders Daily Check', dataset: 'fact_orders', cron: '0 6 * * *', human: 'Daily at 6:00 AM', rules: 12, lastRun: '2026-05-05 06:00', nextRun: '2026-05-06 06:00', status: 'active', lastDuration: '42s', connection: 'SF_Codex', owner: 'Bhaskar R.' },
  { id: 'sc2', name: 'Customer Quality Scan', dataset: 'dim_customers', cron: '0 */6 * * *', human: 'Every 6 hours', rules: 8, lastRun: '2026-05-05 12:00', nextRun: '2026-05-05 18:00', status: 'active', lastDuration: '28s', connection: 'SF_Codex', owner: 'Priya M.' },
  { id: 'sc3', name: 'Payment Reconciliation', dataset: 'fact_payments', cron: '30 5 * * 1-5', human: 'Weekdays at 5:30 AM', rules: 6, lastRun: '2026-05-05 05:30', nextRun: '2026-05-06 05:30', status: 'active', lastDuration: '1m 14s', connection: 'SF_Codex', owner: 'Bhaskar R.' },
  { id: 'sc4', name: 'Inventory Snapshot Check', dataset: 'fact_inventory', cron: '0 */4 * * *', human: 'Every 4 hours', rules: 5, lastRun: '2026-05-05 16:00', nextRun: '2026-05-05 20:00', status: 'paused', lastDuration: '19s', connection: 'SF_Codex', owner: 'Rajan S.' },
  { id: 'sc5', name: 'Web Sessions Hourly', dataset: 'web_sessions', cron: '0 * * * *', human: 'Every hour', rules: 4, lastRun: '2026-05-05 17:00', nextRun: '2026-05-05 18:00', status: 'active', lastDuration: '8s', connection: 'SF_Codex', owner: 'Priya M.' },
  { id: 'sc6', name: 'Weekly Full Audit', dataset: 'ALL datasets', cron: '0 2 * * 0', human: 'Sundays at 2:00 AM', rules: 41, lastRun: '2026-05-04 02:00', nextRun: '2026-05-11 02:00', status: 'active', lastDuration: '8m 32s', connection: 'SF_Codex', owner: 'Bhaskar R.' },
]

const statStyle: Record<string, { bg: string; color: string }> = {
  active: { bg: '#f0fdf4', color: '#16a34a' },
  paused: { bg: '#f8fafc', color: '#64748b' },
  failed: { bg: '#fee2e2', color: '#dc2626' },
}

export default function SchedulesPage() {
  const [scheduleList, setScheduleList] = useState(schedules)

  function toggle(id: string) {
    setScheduleList(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s))
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Schedules</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Automate quality checks — {scheduleList.filter(s => s.status === 'active').length} of {scheduleList.length} schedules active</p>
        </div>
        <button style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ New Schedule</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Schedules', value: scheduleList.length, icon: '📅' }, { label: 'Active', value: scheduleList.filter(s => s.status === 'active').length, icon: '▶️' }, { label: 'Paused', value: scheduleList.filter(s => s.status === 'paused').length, icon: '⏸️' }, { label: 'Total Rules Covered', value: scheduleList.reduce((a, s) => a + s.rules, 0), icon: '🛡️' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fafaf9', borderBottom: '1px solid #ebe8df' }}>
              {['Schedule','Dataset','Frequency','Rules','Last Run','Next Run','Duration','Owner','Status','Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleList.map((s, i) => {
              const ss = statStyle[s.status]
              return (
                <tr key={s.id} style={{ borderBottom: i < scheduleList.length - 1 ? '1px solid #f3f1ea' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.cron}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12.5px' }}>{s.dataset}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{s.human}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#2563eb', textAlign: 'center' }}>{s.rules}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>{s.lastRun}</td>
                  <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{s.nextRun}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{s.lastDuration}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>{s.owner}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ ...ss, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => toggle(s.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '11.5px', cursor: 'pointer' }}>
                        {s.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                      </button>
                      <button style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #dbeafe', background: '#fff', color: '#2563eb', fontSize: '11.5px', cursor: 'pointer' }}>▶ Run Now</button>
                    </div>
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
