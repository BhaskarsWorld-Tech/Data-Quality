'use client'
import { useEffect, useState } from 'react'
import { ConnectionToolbar, ConnectionBanner, SfConn, ConnectionListItem } from '@/components/shared/ConnectionToolbar'

interface Column { name: string; type: string; nullable: string; position: number }
interface SchemaTable { name: string; type: string; rows: number; bytes: number; columns: Column[] }
interface Contract {
  id: string; name: string; table: string
  status: 'valid' | 'drift' | 'pending'
  version: string; consumers: string[]
  columns: Column[]
  rowCount: number
}

function ownerFor(name: string) {
  const u = name.toUpperCase()
  if (u.includes('CUSTOMER') || u.includes('SALE')) return 'Sales Ops'
  if (u.includes('SUPPLIER') || u.includes('PURCHASE') || u.includes('SHIPMENT') || u.includes('CARRIER')) return 'Supply Chain'
  if (u.includes('PRODUCT') || u.includes('CATEGORY')) return 'Catalog Team'
  if (u.includes('INVENTORY') || u.includes('WAREHOUSE')) return 'Operations'
  return 'Data Platform'
}

const consumersFor = (name: string) => {
  const u = name.toUpperCase()
  const base = ['Analytics BI']
  if (u.includes('ORDER') || u.includes('SALE')) base.push('Revenue Dashboard', 'Finance Close')
  if (u.includes('INVENTORY')) base.push('Replenishment Model')
  if (u.includes('CUSTOMER')) base.push('CRM Sync', 'Marketing CDP')
  if (u.includes('SHIPMENT')) base.push('Logistics Tracker')
  if (u.includes('SUPPLIER')) base.push('Vendor Scorecard')
  return base
}

export default function ContractsPage() {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [contracts, setContracts]     = useState<Contract[]>([])
  const [conn, setConn]               = useState<SfConn | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState('')
  const [filter, setFilter]           = useState<'all' | 'valid' | 'drift' | 'pending'>('all')
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
      const [schemaRes, connRes] = await Promise.all([
        fetch(`/api/snowflake/schema?connectionId=${id}`, { cache: 'no-store' }),
        fetch('/api/connections'),
      ])
      const { tables }: { tables: SchemaTable[] } = await schemaRes.json()
      const all = await connRes.json() as Array<ConnectionListItem & { warehouse?: string; schema?: string; database?: string }>
      const me = all.find(c => c.id === id)
      if (me) setConn({ id: me.id, name: me.name, warehouse: me.warehouse ?? '', schema: me.schema ?? '', database: me.database ?? '', type: me.type, status: me.status })
      setContracts(tables.map((t, i) => {
        const nullable = t.columns.filter(c => c.nullable === 'YES').length
        const status: Contract['status'] = t.columns.length === 0 ? 'pending' : nullable / Math.max(t.columns.length, 1) > 0.6 ? 'drift' : 'valid'
        return {
          id: `CTR-${String(i + 1).padStart(4, '0')}`,
          name: `${t.name}_contract_v1`,
          table: t.name, status, version: 'v1.0.0',
          consumers: consumersFor(t.name),
          columns: t.columns,
          rowCount: t.rows,
        }
      }))
    } catch (e) {
      setError((e as Error).message); setContracts([])
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (selectedId) load(selectedId) /* eslint-disable-line react-hooks/exhaustive-deps */ }, [selectedId])

  const filtered = contracts.filter(c => filter === 'all' || c.status === filter)
  const counts = {
    total: contracts.length,
    valid: contracts.filter(c => c.status === 'valid').length,
    drift: contracts.filter(c => c.status === 'drift').length,
    pending: contracts.filter(c => c.status === 'pending').length,
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Contracts</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>One contract per live table — {contracts.length} contracts derived from {conn?.schema ?? ''}</p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={() => load(selectedId, true)} refreshing={refreshing} connections={connections} />
      </div>

      <ConnectionBanner conn={conn} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { k: 'all',     label: 'Total Contracts', val: counts.total,   color: '#475569', bg: '#f8fafc' },
          { k: 'valid',   label: 'Valid',           val: counts.valid,   color: '#16a34a', bg: '#f0fdf4' },
          { k: 'drift',   label: 'Drift Detected',  val: counts.drift,   color: '#d97706', bg: '#fffbeb' },
          { k: 'pending', label: 'Pending',         val: counts.pending, color: '#0284c7', bg: '#f0f9ff' },
        ].map(s => {
          const active = filter === s.k
          return (
            <button key={s.k} onClick={() => setFilter(active ? 'all' : s.k as 'all' | 'valid' | 'drift' | 'pending')} style={{
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

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Generating contracts from schema…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(c => {
            const sevColor = c.status === 'valid' ? '#16a34a' : c.status === 'drift' ? '#d97706' : '#0284c7'
            const sevBg    = c.status === 'valid' ? '#dcfce7' : c.status === 'drift' ? '#fef3c7' : '#dbeafe'
            const isExpanded = expanded === c.id
            return (
              <div key={c.id} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? '#6366f1' : '#ebe8df'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: isExpanded ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : c.id)}>
                  <div style={{ width: '4px', alignSelf: 'stretch', background: sevColor, borderRadius: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>{c.name}</span>
                      <span style={{ background: sevBg, color: sevColor, fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>{c.status}</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', fontFamily: 'monospace' }}>{c.version}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', fontFamily: 'monospace' }}>{conn?.schema}.{c.table} · {c.columns.length} columns · {c.rowCount.toLocaleString()} rows</div>
                  </div>
                  {/* Owner block — prominent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', background: '#fafaf9', border: '1px solid #ebe8df', borderRadius: '8px', minWidth: '180px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                      {ownerFor(c.table).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>OWNER</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{ownerFor(c.table)}</div>
                    </div>
                  </div>
                  <span style={{ color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 18px', background: '#fafaf9' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div style={{ background: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>OWNER</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{ownerFor(c.table)}</div>
                      </div>
                      <div style={{ background: '#fff', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>CONSUMERS</div>
                        <div style={{ fontSize: '12px', color: '#475569' }}>{c.consumers.join(', ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, marginBottom: '6px' }}>SCHEMA SPEC ({c.columns.length} columns)</div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #ebe8df' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {['#', 'Column', 'Type', 'Nullable'].map(h =>
                              <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {c.columns.sort((a, b) => a.position - b.position).map(col => (
                            <tr key={col.name} style={{ borderTop: '1px solid #f3f1ea' }}>
                              <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{col.position}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 500 }}>{col.name}</td>
                              <td style={{ padding: '6px 10px' }}>
                                <span style={{ background: '#f1f5f9', padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{col.type}</span>
                              </td>
                              <td style={{ padding: '6px 10px', color: col.nullable === 'YES' ? '#94a3b8' : '#16a34a', fontSize: '11.5px', fontWeight: 500 }}>{col.nullable === 'YES' ? '○ Nullable' : '✓ Not Null'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
