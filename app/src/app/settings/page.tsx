'use client'
import { useState } from 'react'

export default function SettingsPage() {
  const [tab, setTab] = useState<'profile' | 'notifications' | 'api' | 'integrations' | 'workspace'>('profile')
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({ name: 'Bhaskar Reddivari', email: 'yourschinnu@gmail.com', role: 'Admin', timezone: 'Asia/Kolkata', language: 'en' })
  const [notifs, setNotifs] = useState({ emailCritical: true, emailHigh: true, emailWeekly: true, slackCritical: true, slackHigh: false, slackDaily: false, pagerduty: false })
  const [apiKeys] = useState([{ id: 'k1', name: 'CI/CD Pipeline', key: 'dg_live_••••••••••••••••3f2a', created: '2026-01-15', lastUsed: '2026-05-05', status: 'active' }, { id: 'k2', name: 'Grafana Dashboard', key: 'dg_live_••••••••••••••••8c1e', created: '2026-03-01', lastUsed: '2026-05-04', status: 'active' }])

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'api', label: 'API Keys', icon: '🔑' },
    { id: 'integrations', label: 'Integrations', icon: '🔌' },
    { id: 'workspace', label: 'Workspace', icon: '🏢' },
  ] as const

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1100px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 24px' }}>Settings</h1>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Sidebar */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', border: 'none', borderLeft: tab === t.id ? '2px solid #2563eb' : '2px solid transparent', background: tab === t.id ? '#eff6ff' : '#fff', color: tab === t.id ? '#2563eb' : '#475569', fontSize: '13px', fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {tab === 'profile' && (
            <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>Profile Settings</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#fafaf9', borderRadius: '10px', border: '1px solid #ebe8df' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '22px' }}>B</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{profile.name}</div>
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>{profile.role} · {profile.email}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {[['Full Name', 'name'], ['Email', 'email'], ['Role', 'role'], ['Timezone', 'timezone']].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: '12.5px', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>{label}</label>
                    <input value={profile[key as keyof typeof profile]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} disabled={key === 'role'} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#0f172a', background: key === 'role' ? '#f8fafc' : '#fafaf9', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <button onClick={save} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: saved ? '#16a34a' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          )}

          {tab === 'notifications' && (
            <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>Notification Preferences</div>
              {[
                { section: 'Email Notifications', items: [['emailCritical', 'Critical quality issues'], ['emailHigh', 'High severity alerts'], ['emailWeekly', 'Weekly summary report']] },
                { section: 'Slack Notifications', items: [['slackCritical', 'Critical quality issues'], ['slackHigh', 'High severity alerts'], ['slackDaily', 'Daily digest']] },
                { section: 'PagerDuty', items: [['pagerduty', 'Critical incidents (24/7 on-call)']] },
              ].map(({ section, items }) => (
                <div key={section} style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '12px' }}>{section.toUpperCase()}</div>
                  {items.map(([key, label]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f1ea' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>{label}</span>
                      <button onClick={() => setNotifs(n => ({ ...n, [key]: !n[key as keyof typeof n] }))} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: notifs[key as keyof typeof notifs] ? '#2563eb' : '#e2e8f0', cursor: 'pointer', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: '3px', left: notifs[key as keyof typeof notifs] ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s', display: 'block' }} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={save} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: saved ? '#16a34a' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {saved ? '✓ Saved!' : 'Save Preferences'}
              </button>
            </div>
          )}

          {tab === 'api' && (
            <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>API Keys</div>
                <button style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #93c5fd', background: '#dbeafe', color: '#2563eb', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>+ Generate Key</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {apiKeys.map(k => (
                  <div key={k.id} style={{ background: '#fafaf9', borderRadius: '10px', padding: '14px 16px', border: '1px solid #ebe8df' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a', marginBottom: '4px' }}>{k.name}</div>
                        <code style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '5px' }}>{k.key}</code>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                        <button style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '11.5px', cursor: 'pointer' }}>Copy</button>
                        <button style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', fontSize: '11.5px', cursor: 'pointer' }}>Revoke</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11.5px', color: '#94a3b8' }}>
                      <span>Created: {k.created}</span>
                      <span>Last used: {k.lastUsed}</span>
                      <span style={{ color: '#16a34a' }}>● {k.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'integrations' && (
            <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>Integrations</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                {[{ name: 'Slack', icon: '💬', desc: 'Send alerts to Slack channels', connected: true, channel: '#data-alerts' }, { name: 'PagerDuty', icon: '🚨', desc: 'Escalate critical issues 24/7', connected: false, channel: '' }, { name: 'Jira', icon: '📋', desc: 'Auto-create tickets for issues', connected: false, channel: '' }, { name: 'dbt', icon: '🔧', desc: 'Sync dbt model metadata', connected: true, channel: 'analytics project' }, { name: 'GitHub Actions', icon: '⚙️', desc: 'Run checks in CI/CD pipelines', connected: true, channel: 'ci/cd workflow' }, { name: 'Grafana', icon: '📊', desc: 'Visualize quality metrics', connected: false, channel: '' }].map(intg => (
                  <div key={intg.name} style={{ background: '#fafaf9', borderRadius: '10px', padding: '16px', border: `1px solid ${intg.connected ? '#86efac' : '#ebe8df'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '22px' }}>{intg.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a' }}>{intg.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{intg.desc}</div>
                        </div>
                      </div>
                      <span style={{ background: intg.connected ? '#f0fdf4' : '#f8fafc', color: intg.connected ? '#16a34a' : '#94a3b8', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>{intg.connected ? 'Connected' : 'Not connected'}</span>
                    </div>
                    {intg.connected && <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>→ {intg.channel}</div>}
                    <button style={{ marginTop: '10px', width: '100%', padding: '7px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', color: intg.connected ? '#dc2626' : '#2563eb', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                      {intg.connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'workspace' && (
            <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>Workspace Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[['Workspace Name', 'Analytics platform'], ['Organization', 'BhaskarsWorld Tech'], ['Default Connection', 'SF_Codex'], ['Data Retention', '90 days'], ['Timezone', 'Asia/Kolkata (IST)']].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f1ea' }}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '24px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626', marginBottom: '6px' }}>Danger Zone</div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '12px' }}>These actions cannot be undone. Please be certain.</div>
                <button style={{ padding: '7px 16px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}>Reset Workspace Data</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
