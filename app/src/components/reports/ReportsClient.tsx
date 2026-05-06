'use client'
import { useState } from 'react'
import { Report } from '@/lib/types'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const statusConfig = {
  passed: { bg: '#dcfce7', color: '#16a34a', label: '✓ Passed', dot: '#16a34a' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: '✗ Failed', dot: '#dc2626' },
  warning: { bg: '#fef9c3', color: '#ca8a04', label: '⚠ Warning', dot: '#ca8a04' }
}

export default function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()))
  const [selected, setSelected] = useState<Report | null>(reports[0] || null)
  const [running, setRunning] = useState(false)
  const router = useRouter()

  async function runCheck() {
    setRunning(true)
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    })
    const report = await res.json()
    setReports(prev => [report, ...prev])
    setSelected(report)
    setRunning(false)
    router.refresh()
  }

  const scoreColor = (s: number) => s >= 90 ? '#10b981' : s >= 75 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Quality Reports</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{reports.length} report{reports.length !== 1 ? 's' : ''} available</p>
        </div>
        <button onClick={runCheck} disabled={running} style={{
          background: running ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: running ? '#94a3b8' : '#fff',
          border: 'none', padding: '12px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          cursor: running ? 'not-allowed' : 'pointer', boxShadow: running ? 'none' : '0 4px 14px rgba(99,102,241,0.35)'
        }}>{running ? '⏳ Running...' : '▶ Run New Check'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* Reports List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '2px dashed #e2e8f0' }}>
              No reports yet. Run a quality check!
            </div>
          ) : reports.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} style={{
              background: selected?.id === r.id ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))' : '#fff',
              border: selected?.id === r.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid #f1f5f9',
              borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{r.name}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: scoreColor(r.overallScore) }}>{r.overallScore}%</div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDateTime(r.executedAt)}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>✓{r.passed}</span>
                {r.failed > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>✗{r.failed}</span>}
                {r.warnings > 0 && <span style={{ background: '#fef9c3', color: '#ca8a04', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>⚠{r.warnings}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Report Detail */}
        {selected ? (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{selected.name}</h2>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Executed {formatDateTime(selected.executedAt)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '40px', fontWeight: 800, color: scoreColor(selected.overallScore), lineHeight: 1 }}>{selected.overallScore}%</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Overall Score</div>
              </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total Checks', value: selected.totalChecks, bg: '#f8fafc', color: '#0f172a' },
                { label: 'Passed', value: selected.passed, bg: '#dcfce7', color: '#16a34a' },
                { label: 'Failed', value: selected.failed, bg: '#fee2e2', color: '#dc2626' },
                { label: 'Warnings', value: selected.warnings, bg: '#fef9c3', color: '#ca8a04' }
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Trend */}
            {selected.trend && selected.trend.length > 0 && (
              <div style={{ marginBottom: '24px', background: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>7-Day Score Trend</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '50px' }}>
                  {selected.trend.map((t, i) => {
                    const h = Math.max(8, (t.score - 70) * 3)
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div title={`${t.date}: ${t.score}%`} style={{ width: '100%', height: `${h}px`, borderRadius: '4px 4px 0 0', background: scoreColor(t.score), opacity: i === selected.trend.length - 1 ? 1 : 0.5, transition: 'all 0.3s' }} />
                        <div style={{ fontSize: '9px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{t.date.split(' ')[1]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Results Table */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>Check Results</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Rule', 'Table', 'Score', 'Records', 'Failed', 'Status', 'Duration'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.results.map((r, i) => {
                  const s = statusConfig[r.status]
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#0f172a', fontSize: '13px' }}>{r.ruleName}</td>
                      <td style={{ padding: '10px', color: '#64748b' }}>
                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                          {r.tableName}{r.columnName ? `.${r.columnName}` : ''}
                        </code>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${r.score}%`, background: scoreColor(r.score) }} />
                          </div>
                          <span style={{ fontWeight: 700, color: scoreColor(r.score) }}>{r.score}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{formatNumber(r.recordsChecked)}</td>
                      <td style={{ padding: '10px', color: r.recordsFailed > 0 ? '#ef4444' : '#10b981', fontWeight: r.recordsFailed > 0 ? 600 : 400 }}>{formatNumber(r.recordsFailed)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={{ padding: '10px', color: '#94a3b8', fontSize: '12px' }}>{(r.duration / 1000).toFixed(1)}s</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📈</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>No reports yet</div>
            <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Run a quality check to generate your first report</div>
            <button onClick={runCheck} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', cursor: 'pointer' }}>
              ▶ Run Quality Check
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
