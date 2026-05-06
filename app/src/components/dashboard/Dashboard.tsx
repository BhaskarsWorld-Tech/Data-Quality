'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckResult } from '@/lib/types'
import { formatNumber } from '@/lib/utils'

interface DashboardStats {
  totalRules: number
  enabledRules: number
  totalConnections: number
  activeConnections: number
  overallScore: number
  passed: number
  failed: number
  warnings: number
  totalChecks: number
  trend: { date: string; score: number }[]
  recentChecks: CheckResult[]
  lastRunAt: string | null
}

// 6 Dimensions of Data Quality
const dimensions = [
  { name: 'Completeness', score: 98, color: '#16a34a' },
  { name: 'Accuracy', score: 96, color: '#16a34a' },
  { name: 'Validity', score: 87, color: '#ea8b3a' },
  { name: 'Consistency', score: 94, color: '#16a34a' },
  { name: 'Timeliness', score: 79, color: '#dc2626' },
  { name: 'Uniqueness', score: 99, color: '#16a34a' },
]

const failingRules = [
  { name: 'order_total > 0', source: 'orders.transactions', detail: '412 fails', severity: 'critical' },
  { name: 'email matches regex', source: 'crm.users', detail: '287 fails', severity: 'critical' },
  { name: 'freshness < 6h', source: 'ga.sessions', detail: '1.2h late', severity: 'warning' },
  { name: 'sku not null', source: 'inventory.items', detail: '94 fails', severity: 'warning' },
  { name: 'row count Δ < 20%', source: 'finance.ledger', detail: '31% drop', severity: 'warning' },
]

const datasetsAttention = [
  { name: 'prod.orders_fact', source: 'Snowflake', score: 71, freshness: '14m ago', issues: '5 critical', issueColor: '#dc2626', owner: 'Data platform' },
  { name: 'crm.users_dim', source: 'Postgres', score: 82, freshness: '1h ago', issues: '3 medium', issueColor: '#ea8b3a', owner: 'Growth' },
  { name: 'ga.sessions_daily', source: 'BigQuery', score: 85, freshness: '7h late', issues: '2 medium', issueColor: '#ea8b3a', owner: 'Marketing', latefreshness: true },
  { name: 'inv.items_stock', source: 'Databricks', score: 89, freshness: '22m ago', issues: '1 medium', issueColor: '#ea8b3a', owner: 'Supply chain' },
  { name: 'fin.ledger_gl', source: 'Oracle', score: 96, freshness: '3m ago', issues: '— none', issueColor: '#94a3b8', owner: 'Finance' },
]

function ScorePill({ score }: { score: number }) {
  const color = score >= 90 ? '#16a34a' : score >= 80 ? '#ea8b3a' : '#dc2626'
  const bg = score >= 90 ? '#dcfce7' : score >= 80 ? '#fef3c7' : '#fee2e2'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color, padding: '3px 12px', borderRadius: '20px',
      fontSize: '13px', fontWeight: 600, minWidth: '38px'
    }}>{score}</span>
  )
}

function TrendChart({ data }: { data: { date: string; score: number }[] }) {
  if (data.length < 2) return null
  const w = 600, h = 180
  const padding = { top: 20, right: 20, bottom: 30, left: 35 }
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  const max = 100, min = 85
  const xStep = chartW / (data.length - 1)

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - ((d.score - min) / (max - min)) * chartH
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-axis grid */}
      {[100, 95, 90, 85].map(v => {
        const y = padding.top + chartH - ((v - min) / (max - min)) * chartH
        return (
          <g key={v}>
            <line x1={padding.left} x2={w - padding.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
          </g>
        )
      })}

      {/* Bars (incidents) */}
      {data.map((d, i) => {
        const incidents = Math.max(2, Math.floor(Math.random() * 7) + 3)
        const barH = incidents * 4
        return (
          <rect key={`bar-${i}`} x={padding.left + i * xStep - 5} y={padding.top + chartH - barH} width="10" height={barH} fill="#ef4444" opacity="0.85" rx="1" />
        )
      })}

      {/* Area + Line */}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={`pt-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => i % Math.ceil(data.length / 6) === 0 && (
        <text key={`xl-${i}`} x={padding.left + i * xStep} y={h - 10} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.date}</text>
      ))}
    </svg>
  )
}

export default function Dashboard({ stats }: { stats: DashboardStats }) {
  const [running, setRunning] = useState(false)
  const router = useRouter()

  async function runCheck() {
    setRunning(true)
    await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setRunning(false)
    router.refresh()
  }

  // Real or mocked stats fall-back
  const overallScore = stats.overallScore || 94.2
  const trendData = stats.trend.length > 0 ? stats.trend : [
    { date: 'Apr 5', score: 93 }, { date: 'Apr 8', score: 94 }, { date: 'Apr 11', score: 92 },
    { date: 'Apr 14', score: 95 }, { date: 'Apr 17', score: 94 }, { date: 'Apr 20', score: 93 },
    { date: 'Apr 23', score: 96 }, { date: 'Apr 26', score: 94 }, { date: 'Apr 29', score: 96 },
    { date: 'May 2', score: 95 }, { date: 'May 5', score: 97 }
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0, letterSpacing: '-0.4px' }}>
          Data quality overview
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={btnSecondary}>Last 7 days <span style={{ fontSize: '10px', marginLeft: '4px' }}>▾</span></button>
          <button style={btnSecondary}>All <mark style={{ background: '#dbeafe', color: '#2563eb', padding: '0 4px', borderRadius: '3px' }}>domains</mark> <span style={{ fontSize: '10px', marginLeft: '4px' }}>▾</span></button>
          <button onClick={runCheck} disabled={running} style={{
            ...btnPrimary,
            opacity: running ? 0.6 : 1,
            cursor: running ? 'not-allowed' : 'pointer'
          }}>+ {running ? 'Running…' : 'New rule'}</button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {/* Overall Quality Score */}
        <div style={card}>
          <div style={cardLabel}>Overall quality score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', lineHeight: 1 }}>{overallScore.toFixed(1)}</span>
            <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>▲</span>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: '#64748b' }}>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>1.4</span>
              <span>vs last week</span>
            </div>
          </div>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ background: '#16a34a', flex: stats.passed || 268 }} />
            <div style={{ background: '#ea8b3a', flex: stats.warnings || 91 }} />
            <div style={{ background: '#dc2626', flex: stats.failed || 59 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <div><div style={{ color: '#475569' }}>Passing</div><div style={{ fontWeight: 600 }}>{stats.passed || 268}</div></div>
            <div><div style={{ color: '#475569' }}>Warning</div><div style={{ fontWeight: 600 }}>{stats.warnings || 91}</div></div>
            <div><div style={{ color: '#475569' }}>Failing</div><div style={{ fontWeight: 600 }}>{stats.failed || 59}</div></div>
          </div>
        </div>

        {/* Open Issues */}
        <div style={card}>
          <div style={cardLabel}>Open issues</div>
          <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', marginBottom: '12px', lineHeight: 1 }}>23</div>
          <div style={{ fontSize: '12px', color: '#475569' }}>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>8 critical</span> · <span style={{ color: '#ea8b3a', fontWeight: 600 }}>15 medium</span>
          </div>
        </div>

        {/* Datasets monitored */}
        <div style={card}>
          <div style={cardLabel}>Datasets<br/>monitored</div>
          <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', marginBottom: '8px', lineHeight: 1 }}>142</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>across 9 sources</div>
        </div>

        {/* SLA Adherence */}
        <div style={card}>
          <div style={cardLabel}>SLA adherence</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
            <span style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', lineHeight: 1 }}>98.6</span>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#475569' }}>%</span>
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            ▲ 0.3 pts
          </div>
        </div>
      </div>

      {/* Six Dimensions */}
      <div style={{ ...card, padding: '22px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>Six dimensions of quality</div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>scored on 1.2M records · refreshed 4m ago</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {dimensions.map(d => (
            <div key={d.name} style={{ background: '#fafaf5', borderRadius: '10px', padding: '14px 12px', border: '1px solid #ebe8df' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>{d.name}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: d.color, letterSpacing: '-0.5px', marginBottom: '8px' }}>{d.score}<span style={{ fontSize: '14px' }}>%</span></div>
              <div style={{ height: '3px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.score}%`, background: d.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend + Top failing rules */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '20px' }}>
        {/* Trend Chart */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>Quality trend · 30 days</div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                <span style={{ color: '#475569' }}>Score</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
                <span style={{ color: '#475569' }}>Incidents</span>
              </div>
            </div>
          </div>
          <TrendChart data={trendData} />
        </div>

        {/* Top failing rules */}
        <div style={card}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a', marginBottom: '14px' }}>Top failing rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {failingRules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '3px', alignSelf: 'stretch', background: rule.severity === 'critical' ? '#dc2626' : '#ea8b3a', borderRadius: '2px', marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{rule.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{rule.source} · {rule.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Datasets requiring attention */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>Datasets requiring attention</div>
          <a href="/datasets" style={{ fontSize: '12.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>View all 142 →</a>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ebe8df' }}>
              {['Dataset', 'Source', 'Score', 'Freshness', 'Issues', 'Owner'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, fontSize: '11.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datasetsAttention.map((ds, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f1ea' }}>
                <td style={{ padding: '12px', color: '#1a1a1a' }}>
                  <span style={{ color: '#94a3b8' }}>{ds.name.split('.')[0]}.</span>
                  <span style={{ fontWeight: 500 }}>{ds.name.split('.')[1]}</span>
                </td>
                <td style={{ padding: '12px', color: '#475569' }}>{ds.source}</td>
                <td style={{ padding: '12px' }}><ScorePill score={ds.score} /></td>
                <td style={{ padding: '12px', color: ds.latefreshness ? '#ea8b3a' : '#475569' }}>{ds.freshness}</td>
                <td style={{ padding: '12px', color: ds.issueColor, fontWeight: ds.issues === '— none' ? 400 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {ds.issues !== '— none' && <span style={{ color: ds.issueColor }}>•</span>}
                  {ds.issues}
                </td>
                <td style={{ padding: '12px', color: '#475569' }}>{ds.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live data section */}
      {stats.recentChecks.length > 0 && (
        <div style={{ ...card, marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>
              ✦ Your latest check results
            </div>
            <span style={{ fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>LIVE</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ebe8df' }}>
                {['Rule', 'Connection', 'Score', 'Records', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, fontSize: '11.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recentChecks.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f1ea' }}>
                  <td style={{ padding: '12px', color: '#1a1a1a', fontWeight: 500 }}>{c.ruleName}</td>
                  <td style={{ padding: '12px', color: '#475569' }}>{c.connectionName}</td>
                  <td style={{ padding: '12px' }}><ScorePill score={Math.round(c.score)} /></td>
                  <td style={{ padding: '12px', color: '#475569' }}>{formatNumber(c.recordsChecked)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      background: c.status === 'passed' ? '#dcfce7' : c.status === 'failed' ? '#fee2e2' : '#fef3c7',
                      color: c.status === 'passed' ? '#16a34a' : c.status === 'failed' ? '#dc2626' : '#ea8b3a',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase'
                    }}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#ffffff', borderRadius: '12px', padding: '18px 20px',
  border: '1px solid #ebe8df'
}

const cardLabel: React.CSSProperties = {
  fontSize: '12px', color: '#64748b', marginBottom: '10px', fontWeight: 500
}

const btnSecondary: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #ebe8df', padding: '7px 14px',
  borderRadius: '8px', fontSize: '12.5px', color: '#475569', cursor: 'pointer', fontWeight: 500
}

const btnPrimary: React.CSSProperties = {
  background: '#dbeafe', border: '1px solid #93c5fd', padding: '7px 14px',
  borderRadius: '8px', fontSize: '12.5px', color: '#2563eb', cursor: 'pointer', fontWeight: 600
}
