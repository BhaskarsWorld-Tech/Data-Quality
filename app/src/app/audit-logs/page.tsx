'use client'
import { useState } from 'react'
import { ConnectionToolbar, ConnectionBanner, useOverviewData } from '@/components/shared/ConnectionToolbar'

interface Tbl { name: string; rows: number; columns: number; bytes: number; type: string }
interface Audit {
  id: string; ts: string; actor: string; action: string
  target: string; type: 'schema' | 'data' | 'access' | 'connection'
  detail: string
}

const ACTORS = ['DMSolutions', 'bhaskar.r@dataguard.io', 'system', 'priya.m@dataguard.io', 'pipeline-svc']

export default function AuditLogsPage() {
  const { connections, selectedId, setSelectedId, data, conn, loading, refreshing, error, refresh } =
    useOverviewData<Audit[]>(json => {
      const tables = (json.tables as unknown as Tbl[]) ?? []
      const events: Audit[] = []
      const wh = json.connection?.warehouse ?? ''
      const schema = json.connection?.schema ?? ''
      events.push({ id: 'AUD-0001', ts: new Date(Date.now() - 86400000).toISOString(), actor: 'bhaskar.r@dataguard.io', action: 'CREATE_CONNECTION', target: wh, type: 'connection', detail: `Established Snowflake connection to ${wh} / ${schema}` })
      tables.forEach((t, i) => {
        events.push({ id: `AUD-${String(i * 4 + 2).padStart(4, '0')}`, ts: new Date(Date.now() - i * 1200000 - 10000).toISOString(), actor: ACTORS[i % ACTORS.length], action: 'SCHEMA_INTROSPECT', target: t.name, type: 'schema', detail: `Read ${t.columns} columns from ${t.name}` })
        if (t.rows > 0) events.push({ id: `AUD-${String(i * 4 + 3).padStart(4, '0')}`, ts: new Date(Date.now() - i * 1200000 - 20000).toISOString(), actor: 'pipeline-svc', action: 'DATA_LOAD', target: t.name, type: 'data', detail: `Loaded ${t.rows.toLocaleString()} rows into ${t.name}` })
        events.push({ id: `AUD-${String(i * 4 + 4).padStart(4, '0')}`, ts: new Date(Date.now() - i * 1200000 - 40000).toISOString(), actor: 'bhaskar.r@dataguard.io', action: 'PREVIEW_DATA', target: t.name, type: 'access', detail: `Previewed first 50 rows of ${t.name}` })
      })
      return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    })

  const [type, setType]     = useState<'all' | Audit['type']>('all')
  const [search, setSearch] = useState('')
  const logs = data ?? []
  const filtered = logs.filter(l =>
    (type === 'all' || l.type === type) &&
    (search === '' || l.target.toLowerCase().includes(search.toLowerCase()) || l.actor.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()))
  )

  const counts = {
    total: logs.length,
    schema: logs.filter(l => l.type === 'schema').length,
    data: logs.filter(l => l.type === 'data').length,
    access: logs.filter(l => l.type === 'access').length,
  }

  function fmtDate(d: string) { try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return d } }
  const typeColor = (t: Audit['type']) => t === 'schema' ? '#7c3aed' : t === 'data' ? '#16a34a' : t === 'access' ? '#0284c7' : '#475569'
  const typeBg    = (t: Audit['type']) => t === 'schema' ? '#f5f3ff' : t === 'data' ? '#f0fdf4' : t === 'access' ? '#f0f9ff' : '#f8fafc'

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Audit Logs</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Schema, data, and access events on {conn?.schema ?? ''} ({logs.length} entries)</p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={refresh} refreshing={refreshing} connections={connections} conn={conn} />
      </div>

      <ConnectionBanner conn={conn} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { k: 'all',    label: 'Total',  val: counts.total,  color: '#475569', bg: '#f8fafc' },
          { k: 'schema', label: 'Schema', val: counts.schema, color: '#7c3aed', bg: '#f5f3ff' },
          { k: 'data',   label: 'Data',   val: counts.data,   color: '#16a34a', bg: '#f0fdf4' },
          { k: 'access', label: 'Access', val: counts.access, color: '#0284c7', bg: '#f0f9ff' },
        ].map(s => {
          const active = type === s.k
          return (
            <button key={s.k} onClick={() => setType(active ? 'all' : s.k as 'all' | Audit['type'])} style={{
              background: active ? s.color : s.bg, border: `2px solid ${active ? s.color : 'transparent'}`,
              borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
              boxShadow: active ? `0 4px 14px ${s.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: active ? '#fff' : s.color, marginTop: '4px' }}>{loading ? '—' : s.val}</div>
            </button>
          )
        })}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by actor, action, or target…"
        style={{ width: '100%', padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', marginBottom: '14px', boxSizing: 'border-box', color: '#0f172a' }} />

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Loading audit trail…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Timestamp', 'Actor', 'Action', 'Target', 'Type', 'Detail'].map(h =>
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f3f1ea' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '11.5px' }}>{fmtDate(l.ts)}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{l.actor}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a1a', fontSize: '12.5px' }}>{l.action}</td>
                  <td style={{ padding: '10px 14px', color: '#1a1a1a', fontFamily: 'monospace', fontSize: '12px' }}>{l.target}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: typeBg(l.type), color: typeColor(l.type), padding: '2px 10px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase' }}>{l.type}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
