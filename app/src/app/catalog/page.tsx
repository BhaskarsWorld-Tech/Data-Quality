'use client'
import { useState, useEffect } from 'react'

/* ─── types ─────────────────────────────────────────────────────────────── */
interface Column { name: string; type: string; nullable: string; position: number }
interface SnowflakeTable {
  name:    string
  type:    string
  rows:    number
  bytes:   number
  created: string
  updated: string
  columns: Column[]
}

type FilterKey = 'all' | 'dim' | 'fact' | 'view' | 'other'

/* ─── utils ──────────────────────────────────────────────────────────────── */
function classify(name: string, type: string): Exclude<FilterKey, 'all'> {
  const u = name.toUpperCase()
  if (type === 'VIEW' || u.startsWith('VW_'))  return 'view'
  if (u.startsWith('DIM_'))                    return 'dim'
  if (u.startsWith('FACT_'))                   return 'fact'
  return 'other'
}

function tableIcon(name: string): string {
  const u = name.toUpperCase()
  if (u.startsWith('VW_'))           return '🔍'
  if (u.includes('SUPPLIER'))        return '🏭'
  if (u.includes('PRODUCT'))         return '📦'
  if (u.includes('WAREHOUSE'))       return '🏗️'
  if (u.includes('CARRIER'))         return '🚛'
  if (u.includes('LOCATION'))        return '📍'
  if (u.includes('PURCHASE'))        return '📋'
  if (u.includes('INVENTORY'))       return '📊'
  if (u.includes('SHIPMENT'))        return '🚢'
  if (u.includes('RECEIPT'))         return '📥'
  if (u.includes('FORECAST'))        return '📈'
  if (u.includes('QUALITY') || u.includes('INSP')) return '🔎'
  if (u.includes('RETURN'))          return '↩️'
  return '❄️'
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + ' GB'
  if (b >= 1_048_576)     return (b / 1_048_576).toFixed(1) + ' MB'
  if (b >= 1_024)         return (b / 1_024).toFixed(1) + ' KB'
  return b + ' B'
}
function fmtDate(d: string): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d }
}

const classConfig = {
  dim:   { label: 'Dimension', bg: '#f0fdfa', color: '#0f766e', border: '#5eead4' },
  fact:  { label: 'Fact',      bg: '#eff6ff', color: '#1d4ed8', border: '#a5b4fc' },
  view:  { label: 'View',      bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  other: { label: 'Table',     bg: '#fafaf5', color: '#374151', border: '#d1d5db' },
}

const DATA_TYPE_COLOR: Record<string, string> = {
  'NUMBER': '#1d4ed8', 'FLOAT': '#1d4ed8', 'INT': '#1d4ed8', 'INTEGER': '#1d4ed8', 'DECIMAL': '#1d4ed8', 'NUMERIC': '#1d4ed8',
  'TEXT': '#047857', 'VARCHAR': '#047857', 'STRING': '#047857', 'CHAR': '#047857',
  'DATE': '#7c3aed', 'TIMESTAMP_NTZ': '#7c3aed', 'TIMESTAMP': '#7c3aed', 'DATETIME': '#7c3aed',
  'BOOLEAN': '#c2410c',
}

/* ─── component ─────────────────────────────────────────────────────────── */
export default function CatalogPage() {
  const [tables, setTables]     = useState<SnowflakeTable[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [connInfo, setConnInfo] = useState({ database: '', schema: '' })
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<FilterKey>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const [schemaRes, connRes] = await Promise.all([
          fetch('/api/snowflake/schema'),
          fetch('/api/connections'),
        ])
        if (!schemaRes.ok) throw new Error('Failed to fetch schema')
        const { tables: raw } = await schemaRes.json() as { tables: SnowflakeTable[] }
        setTables(raw)
        if (connRes.ok) {
          const connections = await connRes.json() as Array<{ database?: string; schema?: string; status?: string }>
          const active = connections.find(c => c.status === 'active') ?? connections[0]
          if (active) setConnInfo({ database: active.database ?? '', schema: active.schema ?? '' })
        }
      } catch (e) { setError((e as Error).message) }
      finally     { setLoading(false) }
    }
    load()
  }, [])

  const dims   = tables.filter(t => classify(t.name, t.type) === 'dim')
  const facts  = tables.filter(t => classify(t.name, t.type) === 'fact')
  const views  = tables.filter(t => classify(t.name, t.type) === 'view')
  const others = tables.filter(t => classify(t.name, t.type) === 'other')

  const filtered = tables.filter(t => {
    const cl = classify(t.name, t.type)
    if (filter !== 'all' && cl !== filter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statCards: Array<{ key: FilterKey; label: string; value: number; icon: string; color: string; bg: string }> = [
    { key: 'all',   label: 'All Objects', value: tables.length,  icon: '📦', color: '#475569', bg: '#f8fafc' },
    { key: 'dim',   label: 'Dimensions',  value: dims.length,    icon: '🏗️', color: '#0f766e', bg: '#f0fdfa' },
    { key: 'fact',  label: 'Facts',       value: facts.length,   icon: '📊', color: '#1d4ed8', bg: '#eff6ff' },
    { key: 'view',  label: 'Views',       value: views.length,   icon: '🔍', color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'other', label: 'Tables',      value: others.length,  icon: '❄️', color: '#374151', bg: '#fafaf5' },
  ]

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Catalog</h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          {loading ? 'Loading from Snowflake…'
            : error ? 'Could not reach Snowflake'
            : `${connInfo.database}.${connInfo.schema} · ${filtered.length} of ${tables.length} objects`}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '20px' }}>
        {statCards.map(s => {
          const active = filter === s.key
          return (
            <button key={s.key} onClick={() => setFilter(active ? 'all' : s.key)} style={{
              background: active ? s.bg : '#fff',
              border: `2px solid ${active ? s.color + '60' : '#ebe8df'}`,
              borderRadius: '12px', padding: '14px 16px', cursor: loading ? 'default' : 'pointer',
              textAlign: 'left', transition: 'all 0.15s',
              boxShadow: active ? `0 0 0 3px ${s.color}18` : 'none',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '5px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: active ? s.color : '#1a1a1a' }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: '11px', color: active ? s.color : '#64748b', fontWeight: active ? 600 : 400, marginTop: '2px' }}>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tables, views…"
          disabled={loading}
          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a' }}
        />
      </div>

      {/* Loading / error states */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: '#94a3b8' }}>
          <div style={{ fontSize: '40px' }}>❄️</div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Loading catalog from Snowflake…</div>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#dc2626' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Could not connect to Snowflake</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
        </div>
      )}

      {/* Table cards */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 && (
            <div style={{ background: '#fff', border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              No objects match the current filter
            </div>
          )}

          {filtered.map(t => {
            const cl          = classify(t.name, t.type)
            const cfg         = classConfig[cl]
            const isExpanded  = expanded.has(t.name)
            const icon        = tableIcon(t.name)
            const hasData     = t.rows > 0
            const nullCols    = t.columns.filter(c => c.nullable === 'YES').length
            const notNullCols = t.columns.filter(c => c.nullable === 'NO').length

            return (
              <div key={t.name} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? '#6366f1' : '#ebe8df'}`, borderRadius: '14px', padding: '16px 20px', boxShadow: isExpanded ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => toggle(t.name)}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{icon}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>{t.name}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                      {hasData && <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>● Live</span>}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>
                      {connInfo.schema} · {t.columns.length} columns{hasData ? ` · ${fmt(t.rows)} rows · ${fmtBytes(t.bytes)}` : ' · no data'}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '16px' }}>{t.columns.length}</div>
                      <div>Columns</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: hasData ? '#16a34a' : '#94a3b8', fontSize: '16px' }}>{hasData ? fmt(t.rows) : '—'}</div>
                      <div>Rows</div>
                    </div>
                  </div>

                  <span style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '8px', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded: columns */}
                {isExpanded && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    {/* Metadata bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                      {[
                        ['Type',        cfg.label],
                        ['Rows',        hasData ? fmt(t.rows) : 'Empty'],
                        ['Size',        t.bytes > 0 ? fmtBytes(t.bytes) : '—'],
                        ['Nullable cols', `${nullCols} / ${t.columns.length}`],
                        ['NOT NULL cols', String(notNullCols)],
                        ['Last altered', fmtDate(t.updated)],
                        ['Created',     fmtDate(t.created)],
                        ['Schema',      connInfo.schema || '—'],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                          <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Column table */}
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Columns ({t.columns.length})
                    </div>
                    {t.columns.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Column metadata unavailable</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              {['#', 'Column Name', 'Data Type', 'Nullable'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...t.columns].sort((a, b) => a.position - b.position).map(col => {
                              const dtColor = DATA_TYPE_COLOR[col.type.toUpperCase()] ?? '#374151'
                              const isNullable = col.nullable === 'YES'
                              const isKey = col.name.toUpperCase().endsWith('_ID') || col.name.toUpperCase().endsWith('_KEY') || col.name.toUpperCase() === 'ID'
                              return (
                                <tr key={col.name} style={{ borderBottom: '1px solid #f3f1ea' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <td style={{ padding: '7px 10px', color: '#94a3b8', fontSize: '11px' }}>{col.position}</td>
                                  <td style={{ padding: '7px 10px', fontWeight: isKey ? 700 : 500, color: isKey ? '#1d4ed8' : '#1a1a1a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    {isKey && <span title="Key column" style={{ fontSize: '10px' }}>🔑</span>}
                                    {col.name}
                                  </td>
                                  <td style={{ padding: '7px 10px' }}>
                                    <span style={{ background: '#f1f5f9', color: dtColor, padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{col.type}</span>
                                  </td>
                                  <td style={{ padding: '7px 10px' }}>
                                    <span style={{ color: isNullable ? '#94a3b8' : '#16a34a', fontWeight: 500, fontSize: '11.5px' }}>
                                      {isNullable ? '○ Nullable' : '✓ Not Null'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
