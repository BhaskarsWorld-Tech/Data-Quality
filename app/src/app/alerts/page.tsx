'use client'
import { useEffect, useState, useCallback } from 'react'
import { ConnectionToolbar, ConnectionBanner, useOverviewData } from '@/components/shared/ConnectionToolbar'

type Channel = 'email' | 'slack' | 'teams' | 'webex' | 'pagerduty'
type Severity = 'critical' | 'warning' | 'info'

interface Issue { id: string; table: string; severity: Severity; category: string; title: string; detail: string; recommendation: string }
interface Alert {
  id: string; rule: string; table: string; severity: Severity
  triggered: string
  domain: string; owner: string
  context: { detail: string; recommendation: string }
}

/** Classify a table into a business domain by name pattern. */
function tableDomain(name: string): { domain: string; owner: string; color: string } {
  const u = name.toUpperCase()
  if (u.includes('CUSTOMER') || u.includes('SALE'))                          return { domain: 'Sales',        owner: 'Sales Operations', color: '#16a34a' }
  if (u.includes('SUPPLIER') || u.includes('PURCHASE') || u.includes('SHIPMENT') || u.includes('CARRIER') || u.includes('RETURN'))
                                                                              return { domain: 'Supply Chain', owner: 'Supply Chain Team', color: '#1d4ed8' }
  if (u.includes('PRODUCT')  || u.includes('CATEGORY'))                      return { domain: 'Catalog',      owner: 'Product Catalog',   color: '#7c3aed' }
  if (u.includes('INVENTORY')|| u.includes('WAREHOUSE'))                     return { domain: 'Operations',   owner: 'Operations Team',   color: '#ea580c' }
  return { domain: 'Data Platform', owner: 'Data Platform', color: '#475569' }
}

interface AlertConfigUI {
  channels: {
    slack:     { enabled: boolean; webhookUrl: string; groupName: string }
    teams:     { enabled: boolean; webhookUrl: string; channelName: string }
    webex:     { enabled: boolean; webhookUrl: string; spaceName: string }
    email:     { enabled: boolean; recipients: string[]; fromAddress: string }
    pagerduty: { enabled: boolean; routingKey: string }
  }
  autoSend: Record<Severity, boolean>
  lastDispatched: Record<string, string>
}

const CHANNEL_META: Record<Channel, { label: string; icon: string; color: string; bg: string; border: string }> = {
  email:     { label: 'Email',     icon: '📧', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  slack:     { label: 'Slack',     icon: '💬', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  teams:     { label: 'Teams',     icon: '👥', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  webex:     { label: 'Webex',     icon: '🟢', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  pagerduty: { label: 'PagerDuty', icon: '🚨', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
}

export default function AlertsPage() {
  const { connections, selectedId, setSelectedId, data, conn, loading, refreshing, error, refresh } =
    useOverviewData<Alert[]>(json => {
      const issues = (json.issues as unknown as Issue[]) ?? []
      return issues.map((iss, i) => {
        const d = tableDomain(iss.table)
        return {
          id: `ALR-${String(i + 1).padStart(4, '0')}`,
          rule: iss.title, table: iss.table, severity: iss.severity,
          triggered: new Date(Date.now() - i * 1800000).toISOString(),
          domain: d.domain, owner: d.owner,
          context: { detail: iss.detail, recommendation: iss.recommendation },
        }
      })
    })

  const [filter, setFilter]         = useState<'all' | Severity>('all')
  const [acked, setAcked]           = useState<Set<string>>(new Set())
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [sendingFor, setSendingFor] = useState<Alert | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoLog, setAutoLog]       = useState<string>('')

  /* ─── Alert config (channels + auto-send) ───────────────────────────── */
  const [cfg, setCfg] = useState<AlertConfigUI | null>(null)
  const loadCfg = useCallback(async () => {
    const r = await fetch('/api/alerts/config', { cache: 'no-store' })
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { loadCfg() }, [loadCfg])

  /* ─── Save channel config ───────────────────────────────────────────── */
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  async function saveConfig() {
    if (!cfg) return
    setSaving(true); setSaveMsg('')
    try {
      const r = await fetch('/api/alerts/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'save failed')
      setSaveMsg('✓ Configuration saved')
      await loadCfg()
    } catch (e) { setSaveMsg('✗ ' + (e as Error).message) }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  /* ─── Auto-dispatch any new alerts that match autoSend rules ────────── */
  const alerts = data ?? []
  async function runAutoDispatch() {
    if (!cfg) return
    setAutoRunning(true); setAutoLog('')
    const lines: string[] = []
    let dispatched = 0
    for (const a of alerts) {
      if (!cfg.autoSend[a.severity]) continue
      if (cfg.lastDispatched[a.id])  { lines.push(`SKIP ${a.id}: already sent`); continue }
      const res = await fetch('/api/alerts/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: a.id, auto: true, severity: a.severity,
          subject: `[${a.domain}] ${a.rule}`,
          body:    `Domain: ${a.domain}\nOwner: ${a.owner}\nTable: ${conn?.schema}.${a.table}\n\n${a.context.detail}\n\nRecommended fix: ${a.context.recommendation}`,
          domain:  a.domain,
          owner:   a.owner,
          table:   `${conn?.schema}.${a.table}`,
        }),
      })
      const j = await res.json()
      if (j.skipped) lines.push(`SKIP ${a.id}: ${j.skipped}`)
      else if (j.dispatched) {
        dispatched++
        const summary = j.dispatched.map((d: { channel: string; status: string }) => `${d.channel}:${d.status}`).join(', ')
        lines.push(`SENT ${a.id} (${a.severity}) → ${summary}`)
      }
    }
    setAutoLog(`Auto-dispatch run complete · ${dispatched} alerts sent\n${lines.join('\n')}`)
    setAutoRunning(false)
    await loadCfg() // refresh lastDispatched markers
  }

  /* ─── Manual send ───────────────────────────────────────────────────── */
  const [selectedCh, setSelectedCh] = useState<Set<Channel>>(new Set(['email']))
  const [emailTo, setEmailTo]       = useState('yourschinnu@gmail.com')
  const [sendStatus, setSendStatus] = useState<string>('')
  const [sending, setSending]       = useState(false)

  function openSendDialog(a: Alert) {
    setSendingFor(a)
    // Default to enabled channels
    const defaults: Channel[] = []
    if (cfg?.channels.email.enabled) defaults.push('email')
    if (cfg?.channels.slack.enabled) defaults.push('slack')
    if (cfg?.channels.teams.enabled) defaults.push('teams')
    if (cfg?.channels.webex.enabled) defaults.push('webex')
    if (cfg?.channels.pagerduty.enabled && a.severity === 'critical') defaults.push('pagerduty')
    setSelectedCh(new Set(defaults.length > 0 ? defaults : ['email']))
    setSendStatus('')
  }

  async function dispatchAlert() {
    if (!sendingFor) return
    setSending(true); setSendStatus('')
    try {
      const res = await fetch('/api/alerts/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId:  sendingFor.id,
          channels: Array.from(selectedCh),
          to:       emailTo,
          subject:  `[${sendingFor.severity.toUpperCase()}] [${sendingFor.domain}] ${sendingFor.rule}`,
          body:     `Domain: ${sendingFor.domain}\nOwner: ${sendingFor.owner}\nTable: ${conn?.schema}.${sendingFor.table}\n\n${sendingFor.context.detail}\n\nRecommended: ${sendingFor.context.recommendation}`,
          severity: sendingFor.severity,
          domain:   sendingFor.domain,
          owner:    sendingFor.owner,
          table:    `${conn?.schema}.${sendingFor.table}`,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'send failed')
      const lines = (json.dispatched as Array<{ channel: string; status: string; receipt: string }>)
        .map(d => `${d.channel}: ${d.status} — ${d.receipt}`).join('\n')
      setSendStatus(`✓ Dispatched:\n${lines}`)
    } catch (e) {
      setSendStatus(`✗ Error: ${(e as Error).message}`)
    } finally { setSending(false) }
  }

  const filtered = alerts.filter(a => filter === 'all' || a.severity === filter)
  const counts = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    autoSent: cfg ? Object.keys(cfg.lastDispatched).length : 0,
  }
  function fmtDate(d: string) { try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return d } }
  const enabledChannels = (cfg ? (Object.entries(cfg.channels) as [Channel, { enabled: boolean }][]).filter(([, v]) => v.enabled).map(([k]) => k) : [])

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1200px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Alerts</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            {counts.total} live alerts · {enabledChannels.length === 0 ? 'no channels configured' : `auto-routing to ${enabledChannels.join(', ')}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowSettings(true)} style={{ background: '#fff', border: '1px solid #93c5fd', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#1d4ed8', fontWeight: 600 }}>
            ⚙ Channel Settings
          </button>
          <button onClick={runAutoDispatch} disabled={autoRunning || !cfg} style={{ background: '#16a34a', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: autoRunning ? 'not-allowed' : 'pointer', fontSize: '12.5px', color: '#fff', fontWeight: 600, opacity: autoRunning ? 0.6 : 1 }}>
            {autoRunning ? 'Dispatching…' : '⚡ Run Auto-Dispatch'}
          </button>
          <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={refresh} refreshing={refreshing} connections={connections} conn={conn} />
        </div>
      </div>

      <ConnectionBanner conn={conn} />

      {/* Auto-dispatch banner */}
      {cfg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#fff', border: '1px solid #ebe8df', borderRadius: '10px', padding: '10px 16px', marginBottom: '14px', fontSize: '12.5px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>Automated alert routing</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['critical', 'warning', 'info'] as Severity[]).map(sev => (
              <span key={sev} style={{ background: cfg.autoSend[sev] ? '#dcfce7' : '#f1f5f9', color: cfg.autoSend[sev] ? '#16a34a' : '#94a3b8', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
                {cfg.autoSend[sev] ? '✓' : '○'} {sev}
              </span>
            ))}
          </div>
          <span style={{ color: '#94a3b8' }}>→</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {enabledChannels.length === 0 && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>no channels enabled</span>}
            {enabledChannels.map(ch => {
              const m = CHANNEL_META[ch]
              return <span key={ch} style={{ background: m.bg, color: m.color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{m.icon} {m.label}</span>
            })}
          </div>
          <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '11.5px' }}>
            {counts.autoSent} alert{counts.autoSent === 1 ? '' : 's'} auto-dispatched
          </span>
        </div>
      )}

      {autoLog && (
        <div style={{ background: '#0f172a', color: '#a5f3fc', borderRadius: '10px', padding: '14px 18px', fontFamily: 'monospace', fontSize: '11.5px', whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
          {autoLog}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { k: 'all',      label: 'Total',     val: counts.total,    color: '#475569', bg: '#f8fafc',  ro: false },
          { k: 'critical', label: 'Critical',  val: counts.critical, color: '#dc2626', bg: '#fff1f2',  ro: false },
          { k: 'warning',  label: 'Warning',   val: counts.warning,  color: '#d97706', bg: '#fffbeb',  ro: false },
          { k: 'all',      label: 'Auto-sent', val: counts.autoSent, color: '#16a34a', bg: '#f0fdf4',  ro: true  },
        ].map((s, i) => {
          const active = !s.ro && filter === s.k
          return (
            <button key={i} onClick={() => !s.ro && setFilter(active ? 'all' : s.k as 'all' | Severity)} disabled={s.ro} style={{
              background: active ? s.color : s.bg, border: `2px solid ${active ? s.color : 'transparent'}`,
              borderRadius: '12px', padding: '14px 18px', cursor: s.ro ? 'default' : 'pointer', textAlign: 'left',
              boxShadow: active ? `0 4px 14px ${s.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: active ? '#fff' : s.color, marginTop: '4px' }}>{loading ? '—' : s.val}</div>
            </button>
          )
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Loading alerts…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px' }}>✓</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#16a34a', marginTop: '8px' }}>No active alerts</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(a => {
            const isAcked = acked.has(a.id)
            const wasAutoSent = !!cfg?.lastDispatched[a.id]
            const sevColor = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#0284c7'
            const sevBg    = a.severity === 'critical' ? '#fee2e2' : a.severity === 'warning' ? '#fef3c7' : '#f0f9ff'
            const isExpanded = expanded === a.id
            return (
              <div key={a.id} style={{ background: isAcked ? '#fafafa' : '#fff', border: `1.5px solid ${isExpanded ? '#6366f1' : '#ebe8df'}`, borderRadius: '12px', overflow: 'hidden', opacity: isAcked ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : a.id)}>
                  <span style={{ background: sevBg, color: sevColor, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>🔔 {a.severity}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', textDecoration: isAcked ? 'line-through' : 'none' }}>{a.rule}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ background: tableDomain(a.table).color + '18', color: tableDomain(a.table).color, padding: '1px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700 }}>🏷 {a.domain}</span>
                      <span style={{ color: '#475569' }}>👤 {a.owner}</span>
                      <span style={{ fontFamily: 'monospace' }}>{conn?.schema}.{a.table}</span>
                      <span>· {fmtDate(a.triggered)}</span>
                      {wasAutoSent && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '1px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700 }}>✓ AUTO-SENT</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); openSendDialog(a) }}
                    style={{ background: '#1a1a1a', color: '#fff', padding: '5px 12px', borderRadius: '7px', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}>
                    📤 Send
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setAcked(prev => { const next = new Set(prev); next.has(a.id) ? next.delete(a.id) : next.add(a.id); return next }) }}
                    style={{ background: isAcked ? '#e2e8f0' : '#dbeafe', color: isAcked ? '#475569' : '#1d4ed8', padding: '5px 12px', borderRadius: '7px', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}>
                    {isAcked ? 'Acked ✓' : 'Acknowledge'}
                  </button>
                  <span style={{ color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 18px', background: '#fafaf9' }}>
                    <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginBottom: '4px' }}>WHAT HAPPENED</div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '12px' }}>{a.context.detail}</div>
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>RECOMMENDED ACTION</div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a' }}>{a.context.recommendation}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Channel Settings modal ──────────────────────────────────── */}
      {showSettings && cfg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }} onClick={() => setShowSettings(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>Automated Alert Channels</div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>Configure where alerts get sent automatically when quality checks fail</div>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px' }}>✕</button>
            </div>

            {/* Auto-send rules */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px' }}>AUTO-DISPATCH RULES</div>
              {(['critical', 'warning', 'info'] as Severity[]).map(sev => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: '13px', color: '#1a1a1a', textTransform: 'capitalize' }}>
                    Auto-send <strong>{sev}</strong> alerts
                  </span>
                  <button onClick={() => setCfg({ ...cfg, autoSend: { ...cfg.autoSend, [sev]: !cfg.autoSend[sev] } })}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: cfg.autoSend[sev] ? '#16a34a' : '#e2e8f0', cursor: 'pointer', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '3px', left: cfg.autoSend[sev] ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s', display: 'block' }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Slack */}
            <ChannelConfigBlock title="Slack Group" icon="💬" color="#7c3aed" bg="#f5f3ff" enabled={cfg.channels.slack.enabled}
              onToggle={v => setCfg({ ...cfg, channels: { ...cfg.channels, slack: { ...cfg.channels.slack, enabled: v } } })}
              helpUrl={{ label: 'Slack docs', href: 'https://api.slack.com/messaging/webhooks' }}
              helpSteps={[
                'Go to api.slack.com/apps and click "Create New App" → "From scratch".',
                'Name it (e.g. "DataGuard Alerts") and pick the workspace.',
                'In the left sidebar choose "Incoming Webhooks" and toggle it ON.',
                'Click "Add New Webhook to Workspace" and pick the channel (e.g. #data-alerts).',
                'Copy the Webhook URL (starts with https://hooks.slack.com/services/…) and paste it above.',
              ]}>
              <Field label="Incoming Webhook URL" value={cfg.channels.slack.webhookUrl}
                placeholder="https://hooks.slack.com/services/T00/B00/XXX"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, slack: { ...cfg.channels.slack, webhookUrl: v } } })} />
              <Field label="Group Name" value={cfg.channels.slack.groupName}
                placeholder="#data-alerts"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, slack: { ...cfg.channels.slack, groupName: v } } })} />
            </ChannelConfigBlock>

            {/* Teams */}
            <ChannelConfigBlock title="Microsoft Teams Group" icon="👥" color="#1d4ed8" bg="#eff6ff" enabled={cfg.channels.teams.enabled}
              onToggle={v => setCfg({ ...cfg, channels: { ...cfg.channels, teams: { ...cfg.channels.teams, enabled: v } } })}
              helpUrl={{ label: 'Teams docs', href: 'https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook' }}
              helpSteps={[
                'In Teams, go to the channel where you want alerts (e.g. "Data Quality").',
                'Click the "•••" next to the channel name → Manage channel → Connectors.',
                'Find "Incoming Webhook" and click Configure / Add.',
                'Name it "DataGuard Alerts", upload an icon if you want, click Create.',
                'Copy the generated URL (https://yourorg.webhook.office.com/…) and paste it above.',
              ]}>
              <Field label="Incoming Webhook URL" value={cfg.channels.teams.webhookUrl}
                placeholder="https://yourorg.webhook.office.com/webhookb2/XXX"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, teams: { ...cfg.channels.teams, webhookUrl: v } } })} />
              <Field label="Channel Name" value={cfg.channels.teams.channelName}
                placeholder="Data Quality"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, teams: { ...cfg.channels.teams, channelName: v } } })} />
            </ChannelConfigBlock>

            {/* Webex */}
            <ChannelConfigBlock title="Webex Space" icon="🟢" color="#16a34a" bg="#f0fdf4" enabled={cfg.channels.webex.enabled}
              onToggle={v => setCfg({ ...cfg, channels: { ...cfg.channels, webex: { ...cfg.channels.webex, enabled: v } } })}
              helpUrl={{ label: 'Webex docs', href: 'https://apphub.webex.com/applications/incoming-webhooks-cisco-systems' }}
              helpSteps={[
                'Go to apphub.webex.com → search "Incoming Webhooks" → Connect.',
                'Authorize the app for your Webex org.',
                'Choose the space where alerts should arrive (e.g. "Data Alerts").',
                'Name the webhook "DataGuard" and click Add.',
                'Copy the generated URL (https://webexapis.com/v1/webhooks/incoming/…) and paste it above.',
              ]}>
              <Field label="Bot Webhook URL" value={cfg.channels.webex.webhookUrl}
                placeholder="https://webexapis.com/v1/webhooks/incoming/XXX"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, webex: { ...cfg.channels.webex, webhookUrl: v } } })} />
              <Field label="Space Name" value={cfg.channels.webex.spaceName}
                placeholder="Data Alerts"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, webex: { ...cfg.channels.webex, spaceName: v } } })} />
            </ChannelConfigBlock>

            {/* Email */}
            <ChannelConfigBlock title="Email" icon="📧" color="#475569" bg="#f1f5f9" enabled={cfg.channels.email.enabled}
              onToggle={v => setCfg({ ...cfg, channels: { ...cfg.channels, email: { ...cfg.channels.email, enabled: v } } })}
              helpSteps={[
                'Add one or more recipient email addresses, separated by commas.',
                'Outbound email requires an SMTP provider — set SENDGRID_API_KEY (or AWS_SES creds) as env vars in production.',
                'In dev mode emails are queued for inspection rather than delivered.',
              ]}>
              <Field label="Recipients (comma-separated)" value={cfg.channels.email.recipients.join(', ')}
                placeholder="alice@example.com, bob@example.com"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, email: { ...cfg.channels.email, recipients: v.split(',').map(s => s.trim()).filter(Boolean) } } })} />
              <Field label="From Address" value={cfg.channels.email.fromAddress}
                placeholder="alerts@dataguard.io"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, email: { ...cfg.channels.email, fromAddress: v } } })} />
            </ChannelConfigBlock>

            {/* PagerDuty */}
            <ChannelConfigBlock title="PagerDuty" icon="🚨" color="#dc2626" bg="#fee2e2" enabled={cfg.channels.pagerduty.enabled}
              onToggle={v => setCfg({ ...cfg, channels: { ...cfg.channels, pagerduty: { ...cfg.channels.pagerduty, enabled: v } } })}
              helpUrl={{ label: 'PagerDuty docs', href: 'https://support.pagerduty.com/main/docs/services-and-integrations' }}
              helpSteps={[
                'Log in to PagerDuty → Services → choose or create a service.',
                'Open the Integrations tab on that service → Add Integration.',
                'Pick "Events API V2" and click Add.',
                'Copy the 32-character Integration Key and paste it above as the Routing Key.',
              ]}>
              <Field label="Integration Routing Key" value={cfg.channels.pagerduty.routingKey}
                placeholder="32-character integration key"
                onChange={v => setCfg({ ...cfg, channels: { ...cfg.channels, pagerduty: { ...cfg.channels.pagerduty, routingKey: v } } })} />
            </ChannelConfigBlock>

            {saveMsg && (
              <div style={{ background: saveMsg.startsWith('✓') ? '#f0fdf4' : '#fee2e2', color: saveMsg.startsWith('✓') ? '#16a34a' : '#dc2626', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', marginBottom: '12px' }}>
                {saveMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', borderTop: '1px solid #f3f1ea', paddingTop: '16px' }}>
              <button onClick={() => setShowSettings(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button onClick={saveConfig} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Manual Send modal ───────────────────────────────────────── */}
      {sendingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !sending && setSendingFor(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '520px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>Send Alert</div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>{sendingFor.rule}</div>
              </div>
              <button onClick={() => setSendingFor(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '8px' }}>CHANNELS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {(Object.entries(CHANNEL_META) as [Channel, typeof CHANNEL_META.email][]).map(([ch, m]) => {
                const isEnabledInCfg = cfg?.channels[ch].enabled ?? false
                const selected = selectedCh.has(ch)
                return (
                  <button key={ch} onClick={() => setSelectedCh(prev => { const n = new Set(prev); n.has(ch) ? n.delete(ch) : n.add(ch); return n })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      background: selected ? m.bg : '#fafaf9',
                      border: `1.5px solid ${selected ? m.color : '#e2e8f0'}`,
                      borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      opacity: isEnabledInCfg ? 1 : 0.5,
                    }}>
                    <span style={{ fontSize: '18px' }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: selected ? m.color : '#475569' }}>{m.label}</div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{isEnabledInCfg ? 'configured' : 'not configured'}</div>
                    </div>
                    <span style={{ color: selected ? m.color : '#cbd5e1', fontSize: '16px' }}>{selected ? '✓' : '○'}</span>
                  </button>
                )
              })}
            </div>
            {selectedCh.has('email') && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>ADDITIONAL EMAIL TO</label>
                <input value={emailTo} onChange={e => setEmailTo(e.target.value)} type="email"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box', color: '#0f172a', background: '#fafaf9' }} />
              </div>
            )}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>PREVIEW</div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>
                [{sendingFor.severity.toUpperCase()}] [{sendingFor.domain}] {sendingFor.rule}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '4px' }}>
                🏷 {sendingFor.domain} · 👤 {sendingFor.owner} · <span style={{ fontFamily: 'monospace' }}>{conn?.schema}.{sendingFor.table}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569' }}>{sendingFor.context.detail}</div>
            </div>
            {sendStatus && (
              <div style={{ background: sendStatus.startsWith('✓') ? '#f0fdf4' : '#fee2e2', color: sendStatus.startsWith('✓') ? '#16a34a' : '#dc2626', border: `1px solid ${sendStatus.startsWith('✓') ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
                {sendStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSendingFor(null)} disabled={sending} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button onClick={dispatchAlert} disabled={sending || selectedCh.size === 0} style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#1a1a1a', color: '#fff',
                fontSize: '13px', fontWeight: 600, cursor: sending || selectedCh.size === 0 ? 'not-allowed' : 'pointer',
                opacity: sending || selectedCh.size === 0 ? 0.6 : 1,
              }}>
                {sending ? 'Sending…' : `📤 Send to ${selectedCh.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Channel config block ─────────────────────────────────────────────── */
function ChannelConfigBlock({ title, icon, color, bg, enabled, onToggle, helpSteps, helpUrl, children }: {
  title: string; icon: string; color: string; bg: string; enabled: boolean
  onToggle: (v: boolean) => void
  helpSteps?: string[]; helpUrl?: { label: string; href: string }
  children: React.ReactNode
}) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div style={{ background: '#fff', border: `1px solid ${enabled ? color : '#ebe8df'}`, borderRadius: '10px', padding: '14px 18px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: enabled ? '12px' : '0' }}>
        <span style={{ background: bg, padding: '4px 8px', borderRadius: '8px', fontSize: '16px' }}>{icon}</span>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1a1a1a', flex: 1 }}>{title}</span>
        <span style={{ fontSize: '11px', color: enabled ? color : '#94a3b8', fontWeight: 600 }}>{enabled ? 'ENABLED' : 'DISABLED'}</span>
        <button onClick={() => onToggle(!enabled)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: enabled ? color : '#e2e8f0', cursor: 'pointer', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '3px', left: enabled ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
        </button>
      </div>
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {children}
          {helpSteps && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <button onClick={() => setShowHelp(!showHelp)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11.5px', color: '#475569', fontWeight: 600, textAlign: 'left' }}>
                <span style={{ color: color }}>{showHelp ? '▼' : '▶'}</span>
                How do I get this webhook URL?
                {helpUrl && (
                  <a href={helpUrl.href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', color: color, fontWeight: 600, textDecoration: 'none', fontSize: '11px' }}>
                    Open docs ↗
                  </a>
                )}
              </button>
              {showHelp && (
                <ol style={{ margin: 0, padding: '0 12px 12px 32px', fontSize: '11.5px', color: '#475569', lineHeight: 1.6 }}>
                  {helpSteps.map((s, i) => <li key={i} style={{ marginBottom: '2px' }}>{s}</li>)}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>{label.toUpperCase()}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', fontSize: '12.5px', boxSizing: 'border-box', color: '#0f172a', background: '#fafaf9', fontFamily: label.includes('Webhook') || label.includes('Routing') ? 'monospace' : 'inherit' }} />
    </div>
  )
}
