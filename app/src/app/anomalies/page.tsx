'use client'
import { useState, useEffect } from 'react'
import { ConnectionToolbar } from '@/components/shared/ConnectionToolbar'

interface Anomaly {
  id:          string
  table:       string
  type:        string
  severity:    'critical' | 'high' | 'medium'
  observed:    string
  baseline:    string
  delta:       string
  description: string
  status:      string
}

interface Conn { id: string; name: string; warehouse: string; schema: string; database: string; type: string; status: string }
interface ConnectionListItem { id: string; name: string; type: string; status: string; warehouse?: string; schema?: string }

const sevCfg = {
  critical: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  high:     { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  medium:   { bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
}

export default function AnomaliesPage() {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [anoms, setAnoms]             = useState<Anomaly[]>([])
  const [conn, setConn]               = useState<Conn | null>(null)
  const [tableCount, setTableCount]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')
  const [filter, setFilter]           = useState<'all' | 'critical' | 'high' | 'medium'>('all')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [search, setSearch]           = useState('')

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
      setAnoms(json.anomalies ?? [])
      setConn(json.connection)
      setTableCount(json.summary?.tableCount ?? 0)
    } catch (e) {
      setError((e as Error).message)
      setAnoms([])
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (selectedId) load(selectedId) }, [selectedId])

  const filtered = anoms.filter(a =>
    (filter === 'all' || a.severity === filter) &&
    (search === '' || a.table.toLowerCase().includes(search.toLowerCase()) || a.type.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Anomalies</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            Statistical outliers in row volume across {tableCount} live tables
          </p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={() => load(selectedId, true)} refreshing={refreshing} connections={connections} conn={conn} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { k: 'all',      icon: '📡', label: 'Total Detected', val: anoms.length, color: '#6366f1' },
          { k: 'critical', icon: '🔴', label: 'Critical',       val: anoms.filter(a => a.severity === 'critical').length, color: '#dc2626' },
          { k: 'high',     icon: '⚠️', label: 'High',           val: anoms.filter(a => a.severity === 'high').length,     color: '#ea580c' },
          { k: 'medium',   icon: '🟡', label: 'Medium',         val: anoms.filter(a => a.severity === 'medium').length,   color: '#ca8a04' },
          { k: 'all',      icon: '📊', label: 'Tables Scanned', val: tableCount, color: '#16a34a', readonly: true },
        ].map((s, i) => {
          const active = !s.readonly && filter === s.k
          return (
            <button key={i} onClick={() => !s.readonly && setFilter(active ? 'all' : s.k as 'all' | 'critical' | 'high' | 'medium')}
              disabled={s.readonly}
              style={{
                background: active ? s.color : '#fff',
                border: `2px solid ${active ? s.color : '#ebe8df'}`,
                borderRadius: '12px', padding: '16px 20px', cursor: s.readonly ? 'default' : 'pointer', textAlign: 'left',
                boxShadow: active ? `0 4px 16px ${s.color}40` : 'none', transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: '20px', marginBottom: '5px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: active ? '#fff' : s.color }}>{loading ? '—' : s.val}</div>
              <div style={{ fontSize: '11.5px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', marginTop: '2px' }}>{s.label}</div>
            </button>
          )
        })}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by table or anomaly type…"
        style={{ width: '100%', padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', marginBottom: '14px', boxSizing: 'border-box', color: '#0f172a' }} />

      {loading && (
        <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
          <div style={{ fontSize: '28px' }}>📡</div>
          <div style={{ fontSize: '13px' }}>Scanning for statistical outliers…</div>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#16a34a' }}>No anomalies detected</div>
          <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>Row volumes are within expected range across all populated tables</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(a => {
            const cfg = sevCfg[a.severity]
            const isExpanded = expanded === a.id
            return (
              <div key={a.id} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? '#6366f1' : cfg.border}`, borderRadius: '12px', overflow: 'hidden', transition: 'all 0.15s', boxShadow: isExpanded ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : a.id)}>
                  <div style={{ width: '4px', alignSelf: 'stretch', background: cfg.color, borderRadius: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace' }}>{a.id}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize' }}>{a.severity}</span>
                      <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>{a.type}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{a.description}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>{conn?.schema}.{a.table}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: cfg.color }}>{a.delta}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>vs schema avg</div>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafaf9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '4px' }}>OBSERVED</div>
                      <div style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: 600 }}>{a.observed}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '4px' }}>BASELINE</div>
                      <div style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: 600 }}>{a.baseline}</div>
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
