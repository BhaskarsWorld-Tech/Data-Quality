'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ConnectionToolbar } from '@/components/shared/ConnectionToolbar'

/* ─── types ─────────────────────────────────────────────────────────────── */
interface SfTable {
  name: string; type: string; rows: number; bytes: number
  columns: number; nullableColumns: number; notNullColumns: number
}
interface SfConnection {
  id: string; name: string; warehouse: string; schema: string
  database: string; type: string; status: string
}
interface Summary {
  tableCount: number; populated: number; empty: number
  totalRows: number; totalBytes: number
  totalCols: number; nullableCols: number; notNullCols: number
  overallScore: number; completenessScore: number
  populationScore: number; schemaHealthScore: number
}
interface OverviewData {
  connection: SfConnection
  summary:    Summary
  tables:     SfTable[]
  issues:     Array<{ id: string; table: string; severity: string; title: string }>
  anomalies:  Array<{ id: string; table: string; type: string; severity: string }>
}
interface ConnectionListItem {
  id: string; name: string; type: string; status: string
  warehouse?: string; schema?: string
}

/* ─── helpers ───────────────────────────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
function fmtBytes(b: number) {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + ' GB'
  if (b >= 1_048_576)     return (b / 1_048_576).toFixed(1) + ' MB'
  if (b >= 1_024)         return (b / 1_024).toFixed(1) + ' KB'
  return b + ' B'
}
function scoreColor(s: number) { return s >= 90 ? '#16a34a' : s >= 75 ? '#ea8b3a' : '#dc2626' }
function scoreBg(s: number)    { return s >= 90 ? '#dcfce7' : s >= 75 ? '#fef3c7' : '#fee2e2' }

/* ─── connection picker ─────────────────────────────────────────────────── */
function ConnectionPicker({
  connections, value, onChange, onRefresh, refreshing, activeConn
}: {
  connections: ConnectionListItem[]
  value: string
  onChange: (id: string) => void
  onRefresh: () => void
  refreshing: boolean
  activeConn?: SfConnection | null
}) {
  const [open, setOpen] = useState(false)
  const active = connections.find(c => c.id === value)

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{
          background: '#fff', border: '1px solid #93c5fd', padding: '7px 14px',
          borderRadius: '8px', fontSize: '12.5px', color: '#1d4ed8', cursor: 'pointer',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          minWidth: '240px', justifyContent: 'space-between',
          boxShadow: open ? '0 0 0 3px #dbeafe' : '0 1px 2px rgba(0,0,0,0.04)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>❄️</span>
            <span>{active?.name ?? 'Select connection'}</span>
            {active?.status === 'active' && <span style={{ color: '#16a34a', fontSize: '8px' }}>●</span>}
          </span>
          <span style={{ fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
            minWidth: '260px', overflow: 'hidden'
          }}>
            <div style={{ padding: '8px 14px', fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid #f3f1ea' }}>
              {connections.length} CONNECTION{connections.length !== 1 ? 'S' : ''}
            </div>
            {connections.map(c => {
              const isActive = c.id === value
              return (
                <button key={c.id} onClick={() => { onChange(c.id); setOpen(false) }} style={{
                  display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left',
                  background: isActive ? '#eff6ff' : '#fff', border: 'none', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: isActive ? '#1d4ed8' : '#1a1a1a' }}>
                    <span>❄️</span>
                    <span>{c.name}</span>
                    {c.status === 'active' && <span style={{ color: '#16a34a', fontSize: '8px', marginLeft: 'auto' }}>● active</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', marginLeft: '22px' }}>
                    {c.warehouse ?? '—'} · {c.schema ?? '—'}
                  </div>
                </button>
              )
            })}
            <Link href="/connections" style={{ display: 'block', padding: '10px 14px', borderTop: '1px solid #f3f1ea', fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
              + Add new connection
            </Link>
          </div>
        )}
      </div>

      <button onClick={onRefresh} disabled={refreshing} style={{
        background: '#fff', border: '1px solid #e2e8f0', padding: '7px 12px',
        borderRadius: '8px', cursor: refreshing ? 'not-allowed' : 'pointer',
        fontSize: '12.5px', color: '#475569', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '6px',
        opacity: refreshing ? 0.6 : 1,
      }}
      title="Refresh data from Snowflake">
        <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}

/* ─── main dashboard ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [selectedId, setSelectedId]   = useState<string>('')
  const [data, setData]               = useState<OverviewData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')
  const router = useRouter()

  // 1. Load list of connections once
  useEffect(() => {
    fetch('/api/connections')
      .then(r => r.json())
      .then((all: ConnectionListItem[]) => {
        const snowflake = all.filter(c => c.type === 'snowflake')
        setConnections(snowflake)
        const initial = snowflake.find(c => c.status === 'active')?.id ?? snowflake[0]?.id ?? ''
        setSelectedId(initial)
      })
      .catch(e => setError((e as Error).message))
  }, [])

  // 2. Fetch overview whenever selected connection changes
  const fetchOverview = useCallback(async (id: string, isRefresh = false) => {
    if (!id) { setLoading(false); return }
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/snowflake/overview?connectionId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const json = await res.json() as OverviewData & { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError((e as Error).message)
      setData(null)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { if (selectedId) fetchOverview(selectedId) }, [selectedId, fetchOverview])

  const summary  = data?.summary
  const tables   = data?.tables ?? []
  const issues   = data?.issues ?? []
  const anoms    = data?.anomalies ?? []
  const conn     = data?.connection

  const tablesSorted = [...tables].sort((a, b) => b.rows - a.rows)

  /* ─── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0, letterSpacing: '-0.4px' }}>Data quality overview</h1>
          <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0' }}>
            {conn ? `Live metrics from ${conn.warehouse} / ${conn.schema}` : 'Pick a connection to view metrics'}
          </p>
        </div>
        <ConnectionToolbar
          connections={connections}
          selectedId={selectedId}
          onChange={setSelectedId}
          onRefresh={() => fetchOverview(selectedId, true)}
          refreshing={refreshing}
          conn={conn}
        />
      </div>

      {/* Connection details are now shown inline beneath the picker in the header */}

      {/* Loading / error */}
      {loading && (
        <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px' }}>❄️</div>
          <div style={{ fontSize: '14px' }}>Loading live metrics from Snowflake…</div>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#dc2626', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Could not load data</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          {/* KPI cards — all computed from live data */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
            <Link href="/reports" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={cardLabel}>Overall quality score</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 700, color: scoreColor(summary.overallScore), letterSpacing: '-1.5px', lineHeight: 1 }}>{summary.overallScore}</span>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: '#94a3b8' }}>%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  {[
                    ['Complete', summary.completenessScore],
                    ['Populated', summary.populationScore],
                    ['Schema', summary.schemaHealthScore],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <div style={{ color: '#475569' }}>{l}</div>
                      <div style={{ fontWeight: 700, color: scoreColor(v as number) }}>{v}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </Link>

            <Link href="/issues" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={cardLabel}>Open issues</div>
                <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', marginBottom: '8px', lineHeight: 1 }}>{issues.length}</div>
                <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '8px' }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>{issues.filter(i => i.severity === 'critical').length} critical</span>
                  {' · '}
                  <span style={{ color: '#ea8b3a', fontWeight: 600 }}>{issues.filter(i => i.severity === 'warning').length} warning</span>
                </div>
                {issues.length > 0 && (
                  <div style={{ background: scoreBg(100 - issues.length * 5), height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(issues.length * 5, 100)}%`, height: '100%', background: '#dc2626' }} />
                  </div>
                )}
              </div>
            </Link>

            <Link href="/datasets" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={cardLabel}>Datasets monitored</div>
                <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', marginBottom: '8px', lineHeight: 1 }}>{summary.tableCount}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                  {summary.populated} with data · {summary.empty} empty
                </div>
                <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', gap: '1px' }}>
                  <div style={{ background: '#16a34a', flex: summary.populated || 0.0001 }} />
                  <div style={{ background: '#e5e7eb', flex: summary.empty || 0.0001 }} />
                </div>
              </div>
            </Link>

            <Link href="/anomalies" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={cardLabel}>Anomalies detected</div>
                <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-1.5px', marginBottom: '8px', lineHeight: 1 }}>{anoms.length}</div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  Statistical outliers in row volume across {summary.tableCount} tables
                </div>
              </div>
            </Link>
          </div>

          {/* Quality dimensions — derived */}
          <div style={{ ...card, padding: '22px 24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>Quality dimensions · live</div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                scored on {summary.tableCount} tables · {fmt(summary.totalRows)} rows · {summary.totalCols} columns
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { name: 'Completeness',    score: summary.completenessScore, desc: `${summary.notNullCols} of ${summary.totalCols} columns enforce NOT NULL` },
                { name: 'Population',      score: summary.populationScore,   desc: `${summary.populated} of ${summary.tableCount} tables contain data` },
                { name: 'Schema Health',   score: summary.schemaHealthScore, desc: summary.schemaHealthScore === 100 ? 'All tables have readable schema' : 'Some tables missing column metadata' },
              ].map(d => (
                <div key={d.name} style={{ background: '#fafaf5', borderRadius: '10px', padding: '14px 16px', border: '1px solid #ebe8df' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: scoreColor(d.score), letterSpacing: '-0.5px' }}>{d.score}<span style={{ fontSize: '14px' }}>%</span></div>
                  </div>
                  <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden', margin: '8px 0' }}>
                    <div style={{ height: '100%', width: `${d.score}%`, background: scoreColor(d.score), transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{d.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live tables + recent issues side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', marginBottom: '20px' }}>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>
                  Live tables — {conn?.warehouse} / {conn?.schema}
                </div>
                <Link href="/data-browser" style={{ fontSize: '12.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Browse →</Link>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ebe8df' }}>
                    {['Table', 'Type', 'Rows', 'Cols', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, fontSize: '11.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablesSorted.map(t => {
                    const hasData = t.rows > 0
                    return (
                      <tr key={t.name} style={{ borderBottom: '1px solid #f3f1ea', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => router.push('/data-browser')}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a1a' }}>{t.name}</td>
                        <td style={{ padding: '10px 12px', color: '#475569', fontSize: '11.5px' }}>{t.type}</td>
                        <td style={{ padding: '10px 12px', color: hasData ? '#1a1a1a' : '#94a3b8', fontWeight: hasData ? 600 : 400 }}>
                          {hasData ? t.rows.toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{t.columns}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: hasData ? '#f0fdf4' : '#f8fafc',
                            color:      hasData ? '#16a34a' : '#94a3b8',
                            padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600
                          }}>{hasData ? '● Active' : '○ Empty'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1a1a1a' }}>Top issues</div>
                <Link href="/issues" style={{ fontSize: '11.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
              </div>
              {issues.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#16a34a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>✓</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>No issues detected</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Schema is healthy</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {issues.slice(0, 10).map(issue => {
                    const sev = issue.severity
                    const sevColor = sev === 'critical' ? '#dc2626' : sev === 'warning' ? '#ea8b3a' : '#64748b'
                    return (
                      <Link key={issue.id} href="/issues" style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', gap: '10px', padding: '8px 10px', borderRadius: '7px', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ width: '3px', alignSelf: 'stretch', background: sevColor, borderRadius: '2px', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1a1a1a' }}>{issue.title}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{issue.table} · {sev}</div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !error && !summary && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px' }}>❄️</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>No connection selected</div>
          <Link href="/connections" style={{ display: 'inline-block', marginTop: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Add a Snowflake connection →</Link>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties     = { background: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #ebe8df' }
const cardLabel: React.CSSProperties = { fontSize: '12px', color: '#64748b', marginBottom: '10px', fontWeight: 500 }
