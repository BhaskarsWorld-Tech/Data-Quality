'use client'
import { useEffect, useState } from 'react'

interface KeyStatus {
  source:    'env' | 'ui' | 'none'
  hasEnvKey: boolean
  hasUiKey:  boolean
  masked:    string
  valid:     boolean
}

export default function AnthropicKeyPanel() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [input, setInput]   = useState('')
  const [show, setShow]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function load() {
    const r = await fetch('/api/agent/config', { cache: 'no-store' })
    if (r.ok) setStatus(await r.json())
  }
  useEffect(() => { load() }, [])

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/agent/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: input }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'save failed')
      setMsg({ kind: 'ok', text: input ? `Saved key ${j.masked}` : 'Cleared saved key' })
      setInput('')
      await load()
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }) }
    finally { setBusy(false); setTimeout(() => setMsg(null), 3500) }
  }

  async function clearKey() {
    if (!confirm('Remove the saved Anthropic API key?')) return
    setBusy(true)
    try {
      await fetch('/api/agent/config', { method: 'DELETE' })
      setMsg({ kind: 'ok', text: 'Saved key removed' })
      await load()
    } finally { setBusy(false); setTimeout(() => setMsg(null), 3000) }
  }

  async function testKey() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'reply with exactly: pong' }] }),
      })
      const j = await r.json()
      const text: string = j.response ?? ''
      if (text.startsWith('⚠️')) setMsg({ kind: 'err', text: 'Test failed — ' + text.split('**')[1] })
      else setMsg({ kind: 'ok', text: '✓ Anthropic responded: ' + text.slice(0, 80) })
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }) }
    finally { setBusy(false); setTimeout(() => setMsg(null), 5000) }
  }

  if (!status) return null

  const sourceColor = status.source === 'env' ? '#16a34a' : status.source === 'ui' ? '#1d4ed8' : '#dc2626'
  const sourceBg    = status.source === 'env' ? '#dcfce7' : status.source === 'ui' ? '#dbeafe' : '#fee2e2'
  const sourceLabel = status.source === 'env'
    ? 'Loaded from .env.local (env var)'
    : status.source === 'ui'
      ? 'Loaded from saved UI config'
      : 'Not configured'

  return (
    <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <span style={{ fontSize: '20px' }}>🤖</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>Anthropic AI Agent</span>
        <span style={{ background: sourceBg, color: sourceColor, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
          {status.valid ? '● Active' : '○ Inactive'}
        </span>
      </div>
      <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '14px' }}>
        Powers the in-app AI assistant. Get a key at{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 500 }}>console.anthropic.com</a>.
      </div>

      {/* Status row */}
      <div style={{ background: '#fafaf9', border: '1px solid #f3f1ea', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em' }}>ACTIVE KEY</span>
          <span style={{ fontSize: '11px', color: sourceColor, fontWeight: 600 }}>{sourceLabel}</span>
        </div>
        <div style={{ fontSize: '13px', fontFamily: 'monospace', color: status.masked ? '#1a1a1a' : '#94a3b8' }}>
          {status.masked || '— no key configured —'}
        </div>
        {status.hasEnvKey && status.hasUiKey && (
          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '6px' }}>
            ⓘ Both an env var and a UI key are set — the env var wins.
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type={show ? 'text' : 'password'}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="sk-ant-api03-…"
            style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace', background: '#fafaf9', color: '#0f172a', boxSizing: 'border-box' }}
          />
          <button onClick={() => setShow(!show)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>
            {show ? '🙈' : '👁'}
          </button>
        </div>
        <button onClick={save} disabled={busy || !input} style={{
          padding: '9px 18px', borderRadius: '8px', border: 'none',
          background: input && !busy ? '#16a34a' : '#94a3b8', color: '#fff', fontSize: '13px', fontWeight: 600,
          cursor: input && !busy ? 'pointer' : 'not-allowed',
        }}>
          {busy ? 'Saving…' : 'Save Key'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <button onClick={testKey} disabled={busy || !status.valid} style={{
          padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff',
          color: '#475569', fontSize: '12px', fontWeight: 600, cursor: status.valid && !busy ? 'pointer' : 'not-allowed',
          opacity: status.valid && !busy ? 1 : 0.5,
        }}>
          🧪 Test connection
        </button>
        {status.hasUiKey && (
          <button onClick={clearKey} disabled={busy} style={{
            padding: '7px 14px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff',
            color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
          }}>
            🗑 Remove saved key
          </button>
        )}
      </div>

      {msg && (
        <div style={{ background: msg.kind === 'ok' ? '#f0fdf4' : '#fee2e2', color: msg.kind === 'ok' ? '#16a34a' : '#dc2626', border: `1px solid ${msg.kind === 'ok' ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', fontFamily: 'monospace' }}>
          {msg.text}
        </div>
      )}

      <details style={{ marginTop: '14px', fontSize: '11.5px', color: '#475569' }}>
        <summary style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}>Why doesn&apos;t my .env.local key work?</summary>
        <ol style={{ marginTop: '8px', paddingLeft: '20px', lineHeight: 1.6 }}>
          <li>Next.js loads env vars in this order: <code>process.env</code> → <code>.env.local</code> → <code>.env</code>.</li>
          <li>If your shell already has <code>ANTHROPIC_API_KEY=</code> set (even to an empty string), <strong>it overrides</strong> <code>.env.local</code>.</li>
          <li>Run <code>unset ANTHROPIC_API_KEY</code> in the shell that launches the server, then restart.</li>
          <li>Or just paste the key here — the saved UI key kicks in when no env var is set.</li>
        </ol>
      </details>
    </div>
  )
}
