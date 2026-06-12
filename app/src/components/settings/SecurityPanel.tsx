'use client'
import { useEffect, useState } from 'react'

interface SecurityConfig {
  authentication: {
    ssoEnabled: boolean; ssoProvider: string; mfaRequired: boolean; mfaMethod: string
    passwordMinLength: number; passwordRequireSpecial: boolean; passwordRotateDays: number
  }
  session:        { timeoutMinutes: number; maxConcurrent: number; rememberMeAllowed: boolean }
  access:         { ipAllowlistEnabled: boolean; ipAllowlist: string[]; rbacEnabled: boolean; defaultRole: string }
  dataProtection: { encryptAtRest: boolean; encryptInTransit: boolean; piiDetection: boolean; piiMaskingInLogs: boolean; queryAuditEnabled: boolean }
  api:            { keyRotationDays: number; webhookSigning: boolean; rateLimitPerMinute: number; requireHttps: boolean }
  audit:          { retentionDays: number; exportEnabled: boolean; anomalyDetection: boolean }
  compliance:     { soc2: boolean; gdpr: boolean; hipaa: boolean; iso27001: boolean }
}

export default function SecurityPanel() {
  const [cfg, setCfg]         = useState<SecurityConfig | null>(null)
  const [score, setScore]     = useState(0)
  const [breakdown, setBreakdown] = useState<Record<string, number>>({})
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function load() {
    const r = await fetch('/api/security', { cache: 'no-store' })
    const j = await r.json()
    setCfg(j.config); setScore(j.score); setBreakdown(j.breakdown)
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!cfg) return
    setSaving(true); setSaveMsg('')
    try {
      const r = await fetch('/api/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'save failed')
      setSaveMsg('✓ Security settings saved')
      await load()
    } catch (e) { setSaveMsg('✗ ' + (e as Error).message) }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  if (!cfg) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading security settings…</div>

  function set<K extends keyof SecurityConfig>(section: K, patch: Partial<SecurityConfig[K]>) {
    setCfg(prev => prev ? { ...prev, [section]: { ...prev[section], ...patch } } : prev)
  }

  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  const scoreBg    = score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : '#fee2e2'
  const scoreLabel = score >= 80 ? 'Strong'  : score >= 60 ? 'Moderate' : 'Weak'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Score banner */}
      <div style={{ background: '#fff', border: `1px solid ${scoreColor}40`, borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: scoreBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `4px solid ${scoreColor}` }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: scoreColor }}>{score}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>Security Posture</span>
            <span style={{ background: scoreBg, color: scoreColor, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{scoreLabel}</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '10px' }}>Calculated from {Object.keys(breakdown).length} security domains. Higher score = stronger defenses.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {(Object.entries(breakdown) as [string, number][]).map(([k, v]) => (
              <div key={k} style={{ background: '#fafaf9', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.slice(0, 8)}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: v > 8 ? '#16a34a' : v > 4 ? '#d97706' : '#94a3b8' }}>+{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AUTHENTICATION */}
      <Section title="Authentication" icon="🔐" desc="Identity verification and password requirements">
        <Toggle label="Single Sign-On (SSO)" desc="Allow users to sign in via your IdP" checked={cfg.authentication.ssoEnabled} onChange={v => set('authentication', { ssoEnabled: v })} />
        {cfg.authentication.ssoEnabled && (
          <Select label="SSO Provider" value={cfg.authentication.ssoProvider}
            options={[['none','—'],['okta','Okta'],['azure-ad','Azure AD / Entra ID'],['google','Google Workspace']]}
            onChange={v => set('authentication', { ssoProvider: v as 'okta' | 'azure-ad' | 'google' | 'none' })} />
        )}
        <Toggle label="Require Multi-Factor Authentication" desc="Force MFA for all users at login" checked={cfg.authentication.mfaRequired} onChange={v => set('authentication', { mfaRequired: v })} />
        {cfg.authentication.mfaRequired && (
          <Select label="MFA Method" value={cfg.authentication.mfaMethod}
            options={[['totp','TOTP (Authenticator app)'],['sms','SMS code'],['webauthn','WebAuthn / Passkey']]}
            onChange={v => set('authentication', { mfaMethod: v as 'totp' | 'sms' | 'webauthn' })} />
        )}
        <Number label="Minimum Password Length" value={cfg.authentication.passwordMinLength} min={8} max={64} suffix="chars" onChange={v => set('authentication', { passwordMinLength: v })} />
        <Toggle label="Require Special Characters" desc="Passwords must include !@#$%^&* etc." checked={cfg.authentication.passwordRequireSpecial} onChange={v => set('authentication', { passwordRequireSpecial: v })} />
        <Number label="Password Rotation Period" value={cfg.authentication.passwordRotateDays} min={30} max={365} suffix="days" onChange={v => set('authentication', { passwordRotateDays: v })} />
      </Section>

      {/* SESSION */}
      <Section title="Session Management" icon="⏱️" desc="How long users stay logged in and how many devices">
        <Number label="Session Timeout" value={cfg.session.timeoutMinutes} min={5} max={1440} suffix="min" onChange={v => set('session', { timeoutMinutes: v })} />
        <Number label="Max Concurrent Sessions" value={cfg.session.maxConcurrent} min={1} max={20} suffix="devices" onChange={v => set('session', { maxConcurrent: v })} />
        <Toggle label='Allow "Remember Me"' desc="Lets users stay signed in for 30 days" checked={cfg.session.rememberMeAllowed} onChange={v => set('session', { rememberMeAllowed: v })} />
      </Section>

      {/* ACCESS CONTROL */}
      <Section title="Access Control" icon="🚦" desc="Restrict who can connect and what they can do">
        <Toggle label="Role-Based Access Control" desc="Use viewer / analyst / editor / admin roles" checked={cfg.access.rbacEnabled} onChange={v => set('access', { rbacEnabled: v })} />
        {cfg.access.rbacEnabled && (
          <Select label="Default Role for New Users" value={cfg.access.defaultRole}
            options={[['viewer','Viewer (read-only)'],['analyst','Analyst (read + run checks)'],['editor','Editor (manage rules)'],['admin','Admin (full access)']]}
            onChange={v => set('access', { defaultRole: v as 'viewer' | 'analyst' | 'editor' | 'admin' })} />
        )}
        <Toggle label="IP Allowlist" desc="Block sign-ins from outside approved CIDRs" checked={cfg.access.ipAllowlistEnabled} onChange={v => set('access', { ipAllowlistEnabled: v })} />
        {cfg.access.ipAllowlistEnabled && (
          <TextArea label="Allowed CIDRs" value={cfg.access.ipAllowlist.join('\n')} placeholder="10.0.0.0/8&#10;192.168.1.0/24"
            onChange={v => set('access', { ipAllowlist: v.split('\n').map(s => s.trim()).filter(Boolean) })} />
        )}
      </Section>

      {/* DATA PROTECTION */}
      <Section title="Data Protection" icon="🔒" desc="Encryption, PII handling, and query auditing">
        <Toggle label="Encryption at Rest" desc="AES-256 for stored credentials and config" checked={cfg.dataProtection.encryptAtRest} onChange={v => set('dataProtection', { encryptAtRest: v })} />
        <Toggle label="Encryption in Transit" desc="TLS 1.2+ for all client and warehouse connections" checked={cfg.dataProtection.encryptInTransit} onChange={v => set('dataProtection', { encryptInTransit: v })} />
        <Toggle label="PII Detection" desc="Auto-flag columns that look like email / SSN / phone / etc." checked={cfg.dataProtection.piiDetection} onChange={v => set('dataProtection', { piiDetection: v })} />
        <Toggle label="PII Masking in Logs" desc="Redact email/phone/SSN values in audit logs and previews" checked={cfg.dataProtection.piiMaskingInLogs} onChange={v => set('dataProtection', { piiMaskingInLogs: v })} />
        <Toggle label="Query Audit Logging" desc="Log every SQL query run against connected warehouses" checked={cfg.dataProtection.queryAuditEnabled} onChange={v => set('dataProtection', { queryAuditEnabled: v })} />
      </Section>

      {/* API */}
      <Section title="API Security" icon="🛡️" desc="Protect programmatic access and webhooks">
        <Number label="API Key Rotation" value={cfg.api.keyRotationDays} min={30} max={365} suffix="days" onChange={v => set('api', { keyRotationDays: v })} />
        <Toggle label="Sign Outgoing Webhooks (HMAC)" desc="Add X-Signature header so receivers can verify origin" checked={cfg.api.webhookSigning} onChange={v => set('api', { webhookSigning: v })} />
        <Toggle label="Require HTTPS" desc="Reject all plaintext HTTP API calls" checked={cfg.api.requireHttps} onChange={v => set('api', { requireHttps: v })} />
        <Number label="Rate Limit (per API key)" value={cfg.api.rateLimitPerMinute} min={60} max={10000} suffix="req/min" onChange={v => set('api', { rateLimitPerMinute: v })} />
      </Section>

      {/* AUDIT */}
      <Section title="Audit & Monitoring" icon="📜" desc="What gets logged and how long it's kept">
        <Number label="Audit Log Retention" value={cfg.audit.retentionDays} min={30} max={2555} suffix="days" onChange={v => set('audit', { retentionDays: v })} />
        <Toggle label="Audit Log Export" desc="Allow admins to download the audit trail as JSON/CSV" checked={cfg.audit.exportEnabled} onChange={v => set('audit', { exportEnabled: v })} />
        <Toggle label="Login Anomaly Detection" desc="Flag impossible-travel / unusual-time / new-device sign-ins" checked={cfg.audit.anomalyDetection} onChange={v => set('audit', { anomalyDetection: v })} />
      </Section>

      {/* COMPLIANCE */}
      <Section title="Compliance" icon="🏅" desc="Frameworks this workspace adheres to">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {([
            ['soc2','SOC 2 Type II','Service Organization Controls'],
            ['gdpr','GDPR','EU General Data Protection Regulation'],
            ['hipaa','HIPAA','US healthcare data protection'],
            ['iso27001','ISO 27001','Information security management'],
          ] as const).map(([k, name, sub]) => {
            const on = cfg.compliance[k]
            return (
              <button key={k} onClick={() => set('compliance', { [k]: !on } as Partial<SecurityConfig['compliance']>)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                  background: on ? '#f0fdf4' : '#fafaf9', border: `1.5px solid ${on ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ fontSize: '20px' }}>{on ? '✅' : '◯'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: on ? '#16a34a' : '#1a1a1a' }}>{name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{sub}</div>
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      {saveMsg && (
        <div style={{ background: saveMsg.startsWith('✓') ? '#f0fdf4' : '#fee2e2', color: saveMsg.startsWith('✓') ? '#16a34a' : '#dc2626', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', textAlign: 'center' }}>
          {saveMsg}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(to top, #fdfcf7 50%, transparent)', padding: '12px 0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={load} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Discard changes
        </button>
        <button onClick={save} disabled={saving} style={{
          padding: '9px 22px', borderRadius: '8px', border: 'none',
          background: saving ? '#94a3b8' : '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : '🔒 Save Security Settings'}
        </button>
      </div>
    </div>
  )
}

/* ─── Reusable form widgets ────────────────────────────────────────────── */
function Section({ title, icon, desc, children }: { title: string; icon: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{title}</span>
      </div>
      <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '14px', marginLeft: '28px' }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{children}</div>
    </div>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f1ea' }}>
      <div>
        <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: checked ? '#16a34a' : '#e2e8f0', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: '3px', left: checked ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s', display: 'block' }} />
      </button>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f1ea' }}>
      <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fafaf9', fontSize: '12.5px', color: '#1a1a1a', cursor: 'pointer', minWidth: '200px' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function Number({ label, value, min, max, suffix, onChange }: { label: string; value: number; min?: number; max?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f1ea' }}>
      <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input type="number" value={value} min={min} max={max} onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
          style={{ width: '90px', padding: '6px 10px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fafaf9', fontSize: '13px', color: '#1a1a1a', textAlign: 'right' }} />
        {suffix && <span style={{ fontSize: '12px', color: '#94a3b8', minWidth: '50px' }}>{suffix}</span>}
      </div>
    </div>
  )
}

function TextArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f3f1ea' }}>
      <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500, marginBottom: '6px' }}>{label}</div>
      <textarea value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} rows={3}
        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fafaf9', fontSize: '12.5px', color: '#0f172a', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
    </div>
  )
}
