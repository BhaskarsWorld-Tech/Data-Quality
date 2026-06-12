'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ConnectionToolbar } from '@/components/shared/ConnectionToolbar'

interface Issue {
  id:       string
  table:    string
  severity: 'critical' | 'warning' | 'info'
  category: 'completeness' | 'freshness' | 'volume' | 'schema'
  title:    string
  detail:   string
  recommendation: string
}

interface Conn {
  id: string; name: string; warehouse: string; schema: string
  database: string; type: string; status: string
}

interface ConnectionListItem { id: string; name: string; type: string; status: string; warehouse?: string; schema?: string }

const sevCfg = {
  critical: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', label: 'Critical' },
  warning:  { bg: '#fef3c7', color: '#d97706', border: '#fde68a', label: 'Warning'  },
  info:     { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd', label: 'Info'     },
}

const catIcon = {
  completeness: '○',
  freshness:    '⏱',
  volume:       '📊',
  schema:       '🏗️',
}

export default function IssuesPage() {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [issues, setIssues]           = useState<Issue[]>([])
  const [conn, setConn]               = useState<Conn | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')
  const [severity, setSeverity]       = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [category, setCategory]       = useState<'all' | 'completeness' | 'volume' | 'schema' | 'freshness'>('all')
  const [expanded, setExpanded]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then((all: ConnectionListItem[]) => {
      const sf = all.filter(c => c.type === 'snowflake')
      setConnections(sf)
      setSelectedId(sf.find(c => c.status === 'active')?.id ?? sf[0]?.id ?? '')
    }).catch(e => setError((e as Error).message))
  }, [])

  async function load(id: string, isRefresh = false) {
    if (!id) { setLoading(false); return }
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/snowflake/overview?connectionId=${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'load failed')
      setIssues(json.issues ?? [])
      setConn(json.connection)
    } catch (e) {
      setError((e as Error).message)
      setIssues([])
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (selectedId) load(selectedId) }, [selectedId])

  const filtered = issues.filter(i =>
    (severity === 'all' || i.severity === severity) &&
    (category === 'all' || i.category === category)
  )

  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    warning:  issues.filter(i => i.severity === 'warning').length,
    info:     issues.filter(i => i.severity === 'info').length,
    total:    issues.length,
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1200px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Issues</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            {loading ? 'Detecting from live data…' : `${filtered.length} of ${issues.length} issues · ${counts.critical} critical · ${counts.warning} warning`}
          </p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={() => load(selectedId, true)} refreshing={refreshing} connections={connections} conn={conn} />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { k: 'all',      label: 'Total',    val: counts.total,    color: '#475569', bg: '#f8fafc' },
          { k: 'critical', label: 'Critical', val: counts.critical, color: '#dc2626', bg: '#fff1f2' },
          { k: 'warning',  label: 'Warning',  val: counts.warning,  color: '#d97706', bg: '#fffbeb' },
          { k: 'info',     label: 'Info',     val: counts.info,     color: '#0284c7', bg: '#f0f9ff' },
        ].map(s => {
          const active = severity === s.k
          return (
            <button key={s.k} onClick={() => setSeverity(active ? 'all' : s.k as 'all' | 'critical' | 'warning' | 'info')} style={{
              background: active ? s.color : s.bg,
              border: `2px solid ${active ? s.color : 'transparent'}`,
              borderRadius: '14px', padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
              boxShadow: active ? `0 4px 14px ${s.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: active ? '#fff' : s.color, marginTop: '4px' }}>{loading ? '—' : s.val}</div>
            </button>
          )
        })}
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {(['all', 'completeness', 'volume', 'schema', 'freshness'] as const).map(c => {
          const active = category === c
          return (
            <button key={c} onClick={() => setCategory(c)} style={{
              background: active ? '#1a1a1a' : '#fff',
              color:      active ? '#fff' : '#475569',
              border: `1px solid ${active ? '#1a1a1a' : '#e2e8f0'}`,
              padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 500, textTransform: 'capitalize',
            }}>{c}</button>
          )
        })}
      </div>

      {/* Issue cards */}
      {loading && (
        <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
          <div style={{ fontSize: '28px' }}>❄️</div>
          <div style={{ fontSize: '13px' }}>Analyzing schema for quality issues…</div>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#16a34a' }}>No issues found</div>
          <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>All tables in {conn?.schema} are healthy</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(issue => {
            const cfg = sevCfg[issue.severity]
            const isExpanded = expanded === issue.id
            return (
              <div key={issue.id} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? '#6366f1' : cfg.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: isExpanded ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : issue.id)}>
                  <div style={{ width: '4px', alignSelf: 'stretch', background: cfg.color, borderRadius: '2px' }} />
                  <div style={{ fontSize: '20px' }}>{catIcon[issue.category]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace' }}>{issue.id}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>{cfg.label}</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize' }}>{issue.category}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{issue.title}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>{conn?.schema}.{issue.table}</div>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafaf9' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '4px' }}>WHAT'S HAPPENING</div>
                      <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.55 }}>{issue.detail}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '4px' }}>RECOMMENDED FIX</div>
                      <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.55 }}>{issue.recommendation}</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
