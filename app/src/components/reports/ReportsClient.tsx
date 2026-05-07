'use client'
import { useState } from 'react'
import { Report } from '@/lib/types'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const statusConfig = {
  passed:  { bg: '#dcfce7', color: '#16a34a', label: '✓ Passed',  dot: '#16a34a' },
  failed:  { bg: '#fee2e2', color: '#dc2626', label: '✗ Failed',  dot: '#dc2626' },
  warning: { bg: '#fef9c3', color: '#ca8a04', label: '⚠ Warning', dot: '#ca8a04' },
}

const REPORT_TYPES = [
  { id: 'quality',   label: 'Quality Check',     icon: '🛡️', desc: 'Run all active quality rules and score every dataset' },
  { id: 'freshness', label: 'Freshness Report',   icon: '⏱️', desc: 'Check all SLA freshness targets across connections' },
  { id: 'anomaly',   label: 'Anomaly Summary',    icon: '📡', desc: 'Summarise all open anomalies by severity and domain' },
  { id: 'sla',       label: 'SLA Compliance',     icon: '📋', desc: 'Report adherence against every defined SLA' },
  { id: 'lineage',   label: 'Lineage Impact',     icon: '🔗', desc: 'Show downstream impact of datasets with open issues' },
  { id: 'custom',    label: 'Custom Report',      icon: '✨', desc: 'Pick specific datasets, rules, and date range' },
]

const FORMATS = [
  { id: 'web',  label: 'Web Report', icon: '🌐' },
  { id: 'pdf',  label: 'PDF',        icon: '📄' },
  { id: 'csv',  label: 'CSV Export', icon: '📊' },
  { id: 'json', label: 'JSON',       icon: '{ }' },
]

const DOMAINS   = ['All Domains', 'Finance', 'Marketing', 'Supply Chain', 'Catalog', 'Operations']
const DATASETS  = ['All Datasets', 'fact_orders', 'dim_customers', 'fact_payments', 'fact_inventory', 'web_sessions', 'dim_products', 'fact_returns']
const DATE_RANGES = ['Last 24 hours', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom range']

const lbl: React.CSSProperties = { fontSize: '12.5px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }
const sel: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }

export default function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(
    initialReports.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
  )
  const [selected, setSelected] = useState<Report | null>(reports[0] || null)
  const [running, setRunning] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'quality', format: 'web',
    domain: 'All Domains', dataset: 'All Datasets',
    dateRange: 'Last 7 days', includeAnomalies: true,
    includeSLAs: true, includeLineage: false, notify: false,
  })
  const router = useRouter()

  const scoreColor = (s: number) => s >= 90 ? '#10b981' : s >= 75 ? '#f59e0b' : '#ef4444'

  function openCreate() {
    setForm({ name: '', type: 'quality', format: 'web', domain: 'All Domains', dataset: 'All Datasets', dateRange: 'Last 7 days', includeAnomalies: true, includeSLAs: true, includeLineage: false, notify: false })
    setShowModal(true)
  }

  async function runReport() {
    if (!form.name.trim()) return
    setRunning(true)
    setShowModal(false)

    const typeInfo = REPORT_TYPES.find(t => t.id === form.type)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, type: form.type, domain: form.domain, dataset: form.dataset, dateRange: form.dateRange }),
    })
    const report = await res.json()
    // Enrich with form metadata for display
    const enriched = { ...report, name: form.name || `${typeInfo?.label} — ${form.dateRange}` }
    setReports(prev => [enriched, ...prev])
    setSelected(enriched)
    setRunning(false)
    router.refresh()
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Quality Reports</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{reports.length} report{reports.length !== 1 ? 's' : ''} available</p>
        </div>
        <button onClick={openCreate} disabled={running} style={{
          background: running ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: running ? '#94a3b8' : '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
          boxShadow: running ? 'none' : '0 4px 14px rgba(99,102,241,0.3)',
        }}>{running ? '⏳ Running...' : '+ Create Report'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>

        {/* Reports List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📈</div>
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: '6px' }}>No reports yet</div>
              <div style={{ marginBottom: '14px' }}>Create your first quality report</div>
              <button onClick={openCreate} style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ Create Report</button>
            </div>
          ) : reports.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} style={{
              background: selected?.id === r.id ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))' : '#fff',
              border: selected?.id === r.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid #f1f5f9',
              borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
              {[{ label: 'Total Checks', value: selected.totalChecks, bg: '#f8fafc', color: '#0f172a' }, { label: 'Passed', value: selected.passed, bg: '#dcfce7', color: '#16a34a' }, { label: 'Failed', value: selected.failed, bg: '#fee2e2', color: '#dc2626' }, { label: 'Warnings', value: selected.warnings, bg: '#fef9c3', color: '#ca8a04' }].map(card => (
                <div key={card.label} style={{ background: card.bg, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {selected.trend && selected.trend.length > 1 && (() => {
              const W = 560, H = 80, PAD = 12
              const scores = selected.trend.map(t => t.score)
              const minS = Math.min(...scores) - 5
              const maxS = Math.max(...scores) + 5
              const range = maxS - minS || 1
              const pts = selected.trend.map((t, i) => ({
                x: PAD + (i / (selected.trend.length - 1)) * (W - PAD * 2),
                y: H - PAD - ((t.score - minS) / range) * (H - PAD * 2),
                score: t.score,
                label: t.date.split(' ')[1] ?? t.date,
              }))
              const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
              const areaD = `${pathD} L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`
              const last = pts[pts.length - 1]
              return (
                <div style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e9eef5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>7-Day Quality Trend</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: scoreColor(last.score), letterSpacing: '-0.5px' }}>{last.score}%</div>
                  </div>
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={scoreColor(last.score)} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={scoreColor(last.score)} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0, 0.5, 1].map((t, i) => (
                      <line key={i} x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
                    ))}
                    {/* Area fill */}
                    <path d={areaD} fill="url(#trendGrad)" />
                    {/* Trend line */}
                    <path d={pathD} fill="none" stroke={scoreColor(last.score)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Data points + labels */}
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="3.5" fill={i === pts.length - 1 ? scoreColor(p.score) : '#fff'} stroke={scoreColor(p.score)} strokeWidth="2" />
                        <text x={p.x} y={H} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="system-ui,sans-serif">{p.label}</text>
                      </g>
                    ))}
                    {/* Tooltip for last point */}
                    <text x={last.x} y={last.y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={scoreColor(last.score)} fontFamily="system-ui,sans-serif">{last.score}%</text>
                  </svg>
                </div>
              )
            })()}

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
                      <td style={{ padding: '10px', fontWeight: 500, color: '#0f172a' }}>{r.ruleName}</td>
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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📈</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>Select a report</div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Click a report on the left to see its full results</div>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '560px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '22px 24px', borderBottom: '1px solid #ebe8df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>Create Report</div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>Configure and run a new quality report</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '14px' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Report Name */}
              <div>
                <label style={lbl}>Report Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Finance Quality Report" style={{ ...sel, outline: 'none' }} />
              </div>

              {/* Report Type */}
              <div>
                <label style={lbl}>Report Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                  {REPORT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))} style={{ padding: '12px 8px', borderRadius: '10px', border: `1px solid ${form.type === t.id ? '#6366f1' : '#e2e8f0'}`, background: form.type === t.id ? '#f5f3ff' : '#fafaf9', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: '22px', marginBottom: '4px' }}>{t.icon}</div>
                      <div style={{ fontSize: '11px', fontWeight: form.type === t.id ? 700 : 500, color: form.type === t.id ? '#6366f1' : '#475569', lineHeight: '1.3' }}>{t.label}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '7px', border: '1px solid #bae6fd' }}>
                  ℹ️ {REPORT_TYPES.find(t => t.id === form.type)?.desc}
                </div>
              </div>

              {/* Scope */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Domain</label>
                  <select value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={sel}>
                    {DOMAINS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Dataset</label>
                  <select value={form.dataset} onChange={e => setForm(f => ({ ...f, dataset: e.target.value }))} style={sel}>
                    {DATASETS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label style={lbl}>Date Range</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DATE_RANGES.map(dr => (
                    <button key={dr} onClick={() => setForm(f => ({ ...f, dateRange: dr }))} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${form.dateRange === dr ? '#6366f1' : '#e2e8f0'}`, background: form.dateRange === dr ? '#f5f3ff' : '#fff', color: form.dateRange === dr ? '#6366f1' : '#64748b', fontSize: '12px', fontWeight: form.dateRange === dr ? 600 : 400, cursor: 'pointer' }}>
                      {dr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div>
                <label style={lbl}>Include in Report</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'includeAnomalies', label: 'Anomaly detections', icon: '📡' },
                    { key: 'includeSLAs',      label: 'SLA compliance status', icon: '⏱️' },
                    { key: 'includeLineage',   label: 'Data lineage impact', icon: '🔗' },
                    { key: 'notify',           label: 'Send email notification when done', icon: '📧' },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: '#fafaf9', border: '1px solid #ebe8df' }}>
                      <input type="checkbox" checked={form[opt.key as keyof typeof form] as boolean} onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))} style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#6366f1' }} />
                      <span style={{ fontSize: '13px', color: '#475569' }}>{opt.icon} {opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Output Format */}
              <div>
                <label style={lbl}>Output Format</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {FORMATS.map(fmt => (
                    <button key={fmt.id} onClick={() => setForm(f => ({ ...f, format: fmt.id }))} style={{ flex: 1, padding: '9px 6px', borderRadius: '8px', border: `1px solid ${form.format === fmt.id ? '#6366f1' : '#e2e8f0'}`, background: form.format === fmt.id ? '#f5f3ff' : '#fafaf9', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', marginBottom: '3px' }}>{fmt.icon}</div>
                      <div style={{ fontSize: '10.5px', fontWeight: form.format === fmt.id ? 700 : 500, color: form.format === fmt.id ? '#6366f1' : '#64748b' }}>{fmt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={runReport} disabled={!form.name.trim()} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: form.name.trim() ? 'pointer' : 'not-allowed', background: form.name.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e2e8f0', color: form.name.trim() ? '#fff' : '#94a3b8' }}>
                  ▶ Run Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
