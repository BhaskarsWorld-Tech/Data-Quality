'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckResult } from '@/lib/types'
import { formatDateTime, formatNumber } from '@/lib/utils'

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

function ScoreGauge({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ position: 'relative', width: '140px', height: '140px' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '32px', fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>/ 100</div>
      </div>
    </div>
  )
}

function MiniChart({ trend }: { trend: { date: string; score: number }[] }) {
  if (!trend.length) return null
  const max = Math.max(...trend.map(t => t.score))
  const min = Math.min(...trend.map(t => t.score)) - 5
  const h = 60, w = 240

  const points = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * w
    const y = h - ((t.score - min) / (max - min)) * h
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg width={w} height={h + 4} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#chartGrad)" />
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {trend.map((t, i) => {
        const x = (i / (trend.length - 1)) * w
        const y = h - ((t.score - min) / (max - min)) * h
        return i === trend.length - 1 ? (
          <circle key={i} cx={x} cy={y} r="4" fill="#6366f1" stroke="#fff" strokeWidth="2" />
        ) : null
      })}
    </svg>
  )
}

const statusConfig = {
  passed: { bg: '#dcfce7', color: '#16a34a', label: '✓ Passed' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: '✗ Failed' },
  warning: { bg: '#fef9c3', color: '#ca8a04', label: '⚠ Warning' }
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

  const scoreColor = stats.overallScore >= 90 ? '#10b981' : stats.overallScore >= 75 ? '#f59e0b' : '#ef4444'
  const scoreBg = stats.overallScore >= 90 ? '#dcfce7' : stats.overallScore >= 75 ? '#fef9c3' : '#fee2e2'

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Data Quality Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            {stats.lastRunAt ? `Last check: ${formatDateTime(stats.lastRunAt)}` : 'No checks run yet'}
          </p>
        </div>
        <button onClick={runCheck} disabled={running} style={{
          background: running ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: running ? '#94a3b8' : '#fff', border: 'none', padding: '12px 24px',
          borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
          boxShadow: running ? 'none' : '0 4px 14px rgba(99,102,241,0.35)', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {running ? '⏳ Running...' : '▶ Run Quality Check'}
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Overall Score', value: `${stats.overallScore}%`, icon: '🎯', bg: scoreBg, color: scoreColor, sub: stats.totalChecks ? `${stats.totalChecks} checks run` : 'No checks yet' },
          { label: 'Rules', value: stats.enabledRules, icon: '📋', bg: '#ede9fe', color: '#7c3aed', sub: `${stats.totalRules} total, ${stats.enabledRules} active` },
          { label: 'Connections', value: stats.activeConnections, icon: '🔌', bg: '#dbeafe', color: '#2563eb', sub: `${stats.totalConnections} total` },
          { label: 'Checks Passed', value: stats.passed, icon: '✅', bg: '#dcfce7', color: '#16a34a', sub: `${stats.failed} failed, ${stats.warnings} warnings` }
        ].map(card => (
          <div key={card.label} className="fade-in" style={{
            background: '#fff', borderRadius: '16px', padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>{card.label}</div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: card.color, letterSpacing: '-1px', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', marginBottom: '20px' }}>
        {/* Trend Chart */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Quality Score Trend</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Last 7 days</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: scoreColor }}>{stats.overallScore}%</div>
          </div>

          {stats.trend.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <MiniChart trend={stats.trend} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                {stats.trend.map((t, i) => (
                  <div key={i} style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>{t.date}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Run a quality check to see trends
            </div>
          )}
        </div>

        {/* Score Gauge */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '16px', alignSelf: 'flex-start' }}>Quality Score</div>
          <ScoreGauge score={stats.overallScore} />
          <div style={{ marginTop: '16px', width: '100%' }}>
            {[
              { label: 'Passed', value: stats.passed, color: '#10b981', bg: '#dcfce7' },
              { label: 'Failed', value: stats.failed, color: '#ef4444', bg: '#fee2e2' },
              { label: 'Warnings', value: stats.warnings, color: '#f59e0b', bg: '#fef9c3' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                  {item.label}
                </div>
                <span style={{ background: item.bg, color: item.color, padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Checks Table */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '16px' }}>Recent Check Results</div>
        {stats.recentChecks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>
            No checks yet. Run your first quality check! 🚀
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Rule', 'Connection', 'Table', 'Score', 'Records', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600, fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recentChecks.map((check, i) => {
                const s = statusConfig[check.status]
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#0f172a' }}>{check.ruleName}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{check.connectionName}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{check.tableName}</code>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '50px', height: '5px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${check.score}%`, background: check.score >= 98 ? '#10b981' : check.score >= 90 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                        </div>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{check.score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{formatNumber(check.recordsChecked)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
