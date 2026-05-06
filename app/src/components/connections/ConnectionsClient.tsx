'use client'
import { useState } from 'react'
import { Connection, ConnectionType } from '@/lib/types'
import { formatDateTime, connectionIcons } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'csv', label: 'CSV File' },
  { value: 'api', label: 'REST API' },
]

const statusBadge = {
  active: { bg: '#dcfce7', color: '#16a34a', dot: '#16a34a', label: 'Active' },
  inactive: { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8', label: 'Inactive' },
  error: { bg: '#fee2e2', color: '#dc2626', dot: '#dc2626', label: 'Error' }
}

interface Props { initialConnections: Connection[] }

export default function ConnectionsClient({ initialConnections }: Props) {
  const [connections, setConnections] = useState(initialConnections)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'postgresql' as ConnectionType, host: '', port: '', database: '', username: '', schema: '' })
  const router = useRouter()

  async function save() {
    if (!form.name || !form.type) return
    setSaving(true)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, port: form.port ? parseInt(form.port) : undefined })
    })
    const newConn = await res.json()
    setConnections(prev => [...prev, newConn])
    setShowModal(false)
    setForm({ name: '', type: 'postgresql', host: '', port: '', database: '', username: '', schema: '' })
    setSaving(false)
    router.refresh()
  }

  async function deleteConn(id: string) {
    if (!confirm('Delete this connection?')) return
    await fetch(`/api/connections?id=${id}`, { method: 'DELETE' })
    setConnections(prev => prev.filter(c => c.id !== id))
    router.refresh()
  }

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '14px', color: '#0f172a', background: '#f8fafc', outline: 'none', ...style
  })

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Connections</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{connections.length} data source{connections.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none',
          padding: '12px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)'
        }}>+ Add Connection</button>
      </div>

      {/* Connection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {connections.map(conn => {
          const s = statusBadge[conn.status]
          const icon = connectionIcons[conn.type] || '🔌'
          return (
            <div key={conn.id} className="fade-in" style={{
              background: '#fff', borderRadius: '16px', padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{conn.name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px', textTransform: 'capitalize' }}>{conn.type}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot }} />
                  {s.label}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {conn.host && <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px' }}><span style={{ color: '#94a3b8' }}>Host:</span>{conn.host}{conn.port ? `:${conn.port}` : ''}</div>}
                {conn.database && <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px' }}><span style={{ color: '#94a3b8' }}>Database:</span>{conn.database}</div>}
                {conn.schema && <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px' }}><span style={{ color: '#94a3b8' }}>Schema:</span>{conn.schema}</div>}
                {conn.lastTested && <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px' }}><span style={{ color: '#94a3b8' }}>Tested:</span>{formatDateTime(conn.lastTested)}</div>}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  🔗 Test Connection
                </button>
                <button onClick={() => deleteConn(conn.id)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {connections.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔌</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>No connections yet</div>
            <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Add your first data source to start monitoring quality</div>
            <button onClick={() => setShowModal(true)} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>
              + Add Connection
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="slide-up" style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Add Connection</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Connect a new data source</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f8fafc', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Connection Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production PostgreSQL" style={inp()} />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Database Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ConnectionType }))} style={inp()}>
                  {CONNECTION_TYPES.map(t => <option key={t.value} value={t.value}>{connectionIcons[t.value]} {t.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Host</label>
                  <input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="db.example.com" style={inp()} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Port</label>
                  <input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="5432" style={inp()} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Database</label>
                  <input value={form.database} onChange={e => setForm(f => ({ ...f, database: e.target.value }))} placeholder="my_database" style={inp()} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Schema</label>
                  <input value={form.schema} onChange={e => setForm(f => ({ ...f, schema: e.target.value }))} placeholder="public" style={inp()} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Username</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="db_user" style={inp()} />
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving || !form.name} style={{
                  flex: 2, padding: '12px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: form.name ? 'pointer' : 'not-allowed',
                  background: form.name ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                  color: form.name ? '#fff' : '#94a3b8'
                }}>
                  {saving ? '⏳ Saving...' : '+ Add Connection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
