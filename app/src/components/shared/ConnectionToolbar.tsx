'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export interface SfConn {
  id: string; name: string; warehouse: string; schema: string
  database: string; type: string; status: string
}
export interface ConnectionListItem {
  id: string; name: string; type: string; status: string
  warehouse?: string; schema?: string
}

interface Props {
  selectedId: string
  onChange:   (id: string) => void
  onRefresh:  () => void
  refreshing: boolean
  connections: ConnectionListItem[]
  /** Currently selected connection's warehouse / schema (shown inside the dropdown panel). */
  conn?: SfConn | null
}

export function ConnectionToolbar({ selectedId, onChange, onRefresh, refreshing, connections, conn }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef      = useRef<HTMLDivElement>(null)
  const active          = connections.find(c => c.id === selectedId)

  // Live warehouse / database / schema lists discovered from the active Snowflake account
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [databases,  setDatabases]  = useState<string[]>([])
  const [schemas,    setSchemas]    = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [switching,   setSwitching]   = useState<string | null>(null) // which field is updating

  // Effective context — the connection's currently-saved values
  const curWarehouse = conn?.warehouse ?? ''
  const curDatabase  = conn?.database  ?? ''
  const curSchema    = conn?.schema    ?? ''

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Discover warehouses + databases whenever the active connection changes.
  // Schemas come along when the current database is set.
  useEffect(() => {
    if (!selectedId) return
    setDiscovering(true)
    const qs = curDatabase ? `&database=${encodeURIComponent(curDatabase)}` : ''
    fetch(`/api/snowflake/discover?connectionId=${selectedId}${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setWarehouses(d.warehouses ?? [])
        setDatabases(d.databases ?? [])
        if (d.schemas) setSchemas(d.schemas)
      })
      .catch(() => {})
      .finally(() => setDiscovering(false))
  }, [selectedId, curDatabase])

  /** Persist a warehouse / database / schema change against the saved connection and reload. */
  async function applyContext(patch: { warehouse?: string; database?: string; schema?: string }) {
    if (!selectedId) return
    const field = Object.keys(patch)[0]
    setSwitching(field)
    try {
      // Switching database invalidates schema — clear it so the engine doesn't
      // hit "schema X does not exist in DB Y".
      const payload: Record<string, unknown> = { id: selectedId, ...patch }
      if (patch.database && patch.database !== curDatabase) payload.schema = ''
      await fetch('/api/connections', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      onRefresh()           // re-load the page's data with the new context
    } finally {
      setSwitching(null)
    }
  }

  // Per-column search filters inside the unified connection dropdown
  const [whFilter, setWhFilter] = useState('')
  const [dbFilter, setDbFilter] = useState('')
  const [scFilter, setScFilter] = useState('')

  const whFiltered = warehouses.filter(w => w.toLowerCase().includes(whFilter.toLowerCase()))
  const dbFiltered = databases .filter(d => d.toLowerCase().includes(dbFilter.toLowerCase()))
  const scFiltered = schemas   .filter(s => s.toLowerCase().includes(scFilter.toLowerCase()))

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <style>{`@keyframes ct-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>

      {/* Custom dropdown — shows warehouse + schema inside the menu when open */}
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{
          background: '#fff', border: '1px solid #93c5fd', padding: '7px 12px',
          borderRadius: '8px', fontSize: '12.5px', color: '#1d4ed8', cursor: 'pointer',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          minWidth: '220px', justifyContent: 'space-between',
          boxShadow: open ? '0 0 0 3px #dbeafe' : '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>❄️</span>
            <span>{active?.name ?? (connections.length === 0 ? 'No connections' : 'Select connection')}</span>
            {active?.status === 'active' && <span style={{ color: '#16a34a', fontSize: '8px' }}>●</span>}
          </span>
          <span style={{ fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.14)', zIndex: 200,
            width: '780px', overflow: 'hidden',
          }}>
            {/* Connection list (only show if > 1 to save space) */}
            <div style={{ padding: '8px 14px', fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid #f3f1ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{connections.length} CONNECTION{connections.length === 1 ? '' : 'S'} · CONTEXT</span>
              <Link href="/settings" style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                + Manage
              </Link>
            </div>

            {connections.length > 1 && (
              <div style={{ borderBottom: '1px solid #f3f1ea' }}>
                {connections.map(c => {
                  const isActive = c.id === selectedId
                  return (
                    <button key={c.id} onClick={() => onChange(c.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', textAlign: 'left',
                      background: isActive ? '#eff6ff' : '#fff', border: 'none', cursor: 'pointer',
                    }}>
                      <span>❄️</span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isActive ? '#1d4ed8' : '#1a1a1a' }}>{c.name}</span>
                      {c.status === 'active' && <span style={{ color: '#16a34a', fontSize: '9px' }}>● active</span>}
                      {isActive && <span style={{ color: '#2563eb', fontSize: '13px' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* 3-column Warehouse / Database / Schema picker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {/* ── WAREHOUSES column ───────────────────────────────────────── */}
              <div style={{ borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '6px', padding: '6px 10px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>🔍</span>
                    <input value={whFilter} onChange={e => setWhFilter(e.target.value)}
                      placeholder="Warehouses"
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', flex: 1, color: '#0f172a' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {whFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                      {discovering ? 'Loading…' : 'No warehouses'}
                    </div>
                  )}
                  {whFiltered.map(w => {
                    const isActive = w === curWarehouse
                    return (
                      <button key={w}
                        onClick={() => applyContext({ warehouse: w })}
                        disabled={switching === 'warehouse'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                          padding: '8px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                          background: isActive ? '#eff6ff' : '#fff',
                          color: isActive ? '#1d4ed8' : '#0f172a',
                          fontWeight: isActive ? 700 : 500, fontSize: '12.5px',
                        }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>⚙</span>
                        <span style={{ flex: 1 }}>{w}</span>
                        {isActive && <span style={{ color: '#2563eb', fontSize: '13px' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── DATABASES column ────────────────────────────────────────── */}
              <div style={{ borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '6px', padding: '6px 10px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>🔍</span>
                    <input value={dbFilter} onChange={e => setDbFilter(e.target.value)}
                      placeholder="Databases"
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', flex: 1, color: '#0f172a' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {dbFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                      {discovering ? 'Loading…' : 'No databases'}
                    </div>
                  )}
                  {dbFiltered.map(d => {
                    const isActive = d === curDatabase
                    return (
                      <button key={d}
                        onClick={() => applyContext({ database: d })}
                        disabled={switching === 'database'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                          padding: '8px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                          background: isActive ? '#eff6ff' : '#fff',
                          color: isActive ? '#1d4ed8' : '#0f172a',
                          fontWeight: isActive ? 700 : 500, fontSize: '12.5px',
                        }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>🗄</span>
                        <span style={{ flex: 1 }}>{d}</span>
                        {isActive && <span style={{ color: '#2563eb', fontSize: '13px' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── SCHEMAS column ──────────────────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '6px', padding: '6px 10px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>🔍</span>
                    <input value={scFilter} onChange={e => setScFilter(e.target.value)}
                      placeholder="Schemas"
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', flex: 1, color: '#0f172a' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {!curDatabase && (
                    <div style={{ padding: '14px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>Pick a database first</div>
                  )}
                  {curDatabase && scFiltered.length === 0 && (
                    <div style={{ padding: '14px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                      {discovering ? 'Loading…' : 'No schemas'}
                    </div>
                  )}
                  {scFiltered.map(s => {
                    const isActive = s === curSchema
                    return (
                      <button key={s}
                        onClick={() => { applyContext({ schema: s }); setOpen(false) }}
                        disabled={switching === 'schema'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                          padding: '8px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                          background: isActive ? '#eff6ff' : '#fff',
                          color: isActive ? '#1d4ed8' : '#0f172a',
                          fontWeight: isActive ? 700 : 500, fontSize: '12.5px',
                        }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>📁</span>
                        <span style={{ flex: 1 }}>{s}</span>
                        {isActive && <span style={{ color: '#2563eb', fontSize: '13px' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={onRefresh} disabled={refreshing || !selectedId} style={{
        background: '#fff', border: '1px solid #e2e8f0', padding: '7px 12px',
        borderRadius: '8px', cursor: refreshing ? 'not-allowed' : 'pointer',
        fontSize: '12.5px', color: '#475569', fontWeight: 600, opacity: refreshing ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ display: 'inline-block', animation: refreshing ? 'ct-spin 1s linear infinite' : 'none' }}>⟳</span>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}

/** Kept as a no-op — connection details live inside the dropdown menu now. */
export function ConnectionBanner(_props: { conn: SfConn | null; extra?: React.ReactNode }) {
  return null
}

/** Hook that handles connection list + selected ID + data fetching. */
export function useOverviewData<T = unknown>(transform: (json: { connection: SfConn; tables: Array<Record<string, unknown>>; summary: Record<string, unknown>; issues: unknown[]; anomalies: unknown[] }) => T) {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [data, setData]               = useState<T | null>(null)
  const [conn, setConn]               = useState<SfConn | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then((all: ConnectionListItem[]) => {
      const sf = all.filter(c => c.type === 'snowflake')
      setConnections(sf)
      setSelectedId(sf.find(c => c.status === 'active')?.id ?? sf[0]?.id ?? '')
    }).catch(e => { setError((e as Error).message); setLoading(false) })
  }, [])

  async function load(id: string, isRefresh = false) {
    if (!id) { setLoading(false); return }
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/snowflake/overview?connectionId=${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'load failed')
      setData(transform(json))
      setConn(json.connection)
    } catch (e) {
      setError((e as Error).message); setData(null)
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (selectedId) load(selectedId) /* eslint-disable-line react-hooks/exhaustive-deps */ }, [selectedId])

  return { connections, selectedId, setSelectedId, data, conn, loading, refreshing, error, refresh: () => load(selectedId, true) }
}
