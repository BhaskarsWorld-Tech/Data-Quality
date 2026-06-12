'use client'
import { useState } from 'react'

const ROWS = [
  ['Workspace Name',    'Analytics platform'],
  ['Organization',      'BhaskarsWorld Tech'],
  ['Default Connection','DM_Solutions'],
  ['Data Retention',    '90 days'],
  ['Timezone',          'Asia/Kolkata (IST)'],
] as const

const SCOPES = [
  { key: 'connections', label: 'Connections',     description: 'All saved Snowflake / Postgres / etc. connections' },
  { key: 'rules',       label: 'Quality Rules',   description: 'Every quality check rule definition' },
  { key: 'reports',     label: 'Run Reports',     description: 'Historical quality check results' },
  { key: 'alerts',      label: 'Alert Channels',  description: 'Slack / Teams / Webex webhook configuration' },
  { key: 'security',    label: 'Security Config', description: 'SSO, MFA, RBAC, IP allowlist, audit settings' },
] as const

export default function WorkspacePanel() {
  const [open, setOpen]         = useState(false)
  const [scopes, setScopes]     = useState<Set<string>>(new Set(['connections', 'rules', 'reports']))
  const [confirm, setConfirm]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState('')

  async function performReset() {
    if (confirm !== 'RESET' || scopes.size === 0) return
    setBusy(true); setResult('')
    try {
      const r = await fetch('/api/workspace/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: Array.from(scopes), confirm }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'reset failed')
      setResult(`✓ Reset complete · cleared: ${j.cleared.join(', ') || 'nothing'} · skipped: ${j.skipped.join(', ') || 'none'}`)
      setConfirm('')
      // Refresh after a short delay so the user can read the message
      setTimeout(() => { setOpen(false); window.location.reload() }, 2000)
    } catch (e) { setResult('✗ ' + (e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
      <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>Workspace Settings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ROWS.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f1ea' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626', marginBottom: '6px' }}>Danger Zone</div>
        <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '12px' }}>These actions cannot be undone. Please be certain.</div>
        <button onClick={() => setOpen(true)} style={{ padding: '7px 16px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
          Reset Workspace Data
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }} onClick={() => !busy && setOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#dc2626' }}>Reset Workspace Data</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>This permanently deletes the selected data. There is no undo.</div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', margin: '14px 0 8px' }}>SELECT WHAT TO DELETE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {SCOPES.map(s => {
                const on = scopes.has(s.key)
                return (
                  <button key={s.key} onClick={() => setScopes(prev => { const n = new Set(prev); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n })} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px',
                    background: on ? '#fef2f2' : '#fafaf9', border: `1.5px solid ${on ? '#fca5a5' : '#e2e8f0'}`,
                    borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <span style={{ color: on ? '#dc2626' : '#cbd5e1', fontSize: '14px', marginTop: '2px' }}>{on ? '☑' : '☐'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: on ? '#dc2626' : '#1a1a1a' }}>{s.label}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{s.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                TYPE <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>RESET</span> TO CONFIRM
              </label>
              <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="RESET"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${confirm === 'RESET' ? '#86efac' : '#e2e8f0'}`, fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box', background: '#fafaf9', color: '#0f172a' }} />
            </div>

            {result && (
              <div style={{ background: result.startsWith('✓') ? '#f0fdf4' : '#fee2e2', color: result.startsWith('✓') ? '#16a34a' : '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', marginBottom: '14px' }}>
                {result}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} disabled={busy} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={performReset} disabled={busy || confirm !== 'RESET' || scopes.size === 0} style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none',
                background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: (busy || confirm !== 'RESET' || scopes.size === 0) ? 'not-allowed' : 'pointer',
                opacity: (busy || confirm !== 'RESET' || scopes.size === 0) ? 0.5 : 1,
              }}>
                {busy ? 'Resetting…' : `🗑 Delete ${scopes.size} item${scopes.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
