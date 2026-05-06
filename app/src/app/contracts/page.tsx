'use client'
import { useState } from 'react'

const contracts = [
  { id: 'ct1', name: 'Orders → Revenue Model', producer: 'fact_orders', consumer: 'revenue_by_channel', owner: 'Bhaskar R.', status: 'active', compliance: 98, checks: 8, failures: 0, created: '2026-01-15', connection: 'SF_Codex', description: 'Orders table must have non-null revenue, valid currency, and row count > 10K daily.', sla: '99%', terms: ['NOT NULL: revenue, order_id', 'Revenue > 0', 'Row count ≥ 10,000/day', 'Freshness < 4h', 'No duplicate order_ids'] },
  { id: 'ct2', name: 'Customers → Marketing Platform', producer: 'dim_customers', consumer: 'Marketing CDP', owner: 'Priya M.', status: 'active', compliance: 83, checks: 12, failures: 2, created: '2026-02-01', connection: 'SF_Codex', description: 'Customer data exported to CDP must have valid emails, consent flags, and segment assignments.', sla: '95%', terms: ['Email format valid', 'Consent flag NOT NULL', 'Segment must be in [Enterprise, SMB, Consumer]', 'No PII in free-text fields', 'Freshness < 24h'] },
  { id: 'ct3', name: 'Payments → Finance Reports', producer: 'fact_payments', consumer: 'finance_weekly_report', owner: 'Bhaskar R.', status: 'breached', compliance: 61, checks: 6, failures: 3, created: '2026-01-20', connection: 'SF_Codex', description: 'Payment data for finance must reconcile with bank statements within 0.01%.', sla: '99.9%', terms: ['Amount reconciliation < 0.01%', 'No orphaned payment records', 'currency_code in ISO 4217', 'Fraud flag NOT NULL', 'Settled within 3 business days'] },
  { id: 'ct4', name: 'Inventory → Supply Chain API', producer: 'fact_inventory', consumer: 'SCM API v2', owner: 'Rajan S.', status: 'active', compliance: 91, checks: 5, failures: 1, created: '2026-03-10', connection: 'SF_Codex', description: 'Inventory snapshot must be refreshed every 6 hours with positive stock quantities.', sla: '98%', terms: ['Freshness < 6h', 'stock_qty >= 0', 'warehouse_id NOT NULL', 'SKU matches product catalog'] },
  { id: 'ct5', name: 'Web Sessions → Attribution', producer: 'web_sessions', consumer: 'attribution_model', owner: 'Priya M.', status: 'active', compliance: 96, checks: 7, failures: 0, created: '2026-04-01', connection: 'SF_Codex', description: 'Session data piped to attribution model must have valid UTMs and user IDs.', sla: '97%', terms: ['utm_source NOT NULL for paid sessions', 'session_id unique', 'user_id hashed (SHA-256)', 'No sessions > 24h duration'] },
]

const statStyle: Record<string, { bg: string; color: string }> = {
  active: { bg: '#f0fdf4', color: '#16a34a' },
  breached: { bg: '#fee2e2', color: '#dc2626' },
  warning: { bg: '#fff7ed', color: '#ea580c' },
}

export default function ContractsPage() {
  const [selected, setSelected] = useState<typeof contracts[0] | null>(null)
  const [search, setSearch] = useState('')

  const filtered = contracts.filter(c =>
    search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.producer.includes(search) || c.consumer.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Contracts</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Agreements between data producers and consumers — {contracts.filter(c => c.status === 'breached').length} breach{contracts.filter(c => c.status === 'breached').length !== 1 ? 'es' : ''} active</p>
        </div>
        <button style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ New Contract</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[{ label: 'Total Contracts', value: contracts.length, icon: '📄' }, { label: 'Active', value: contracts.filter(c => c.status === 'active').length, icon: '✅' }, { label: 'Breached', value: contracts.filter(c => c.status === 'breached').length, icon: '🚨' }, { label: 'Avg Compliance', value: Math.round(contracts.reduce((s, c) => s + c.compliance, 0) / contracts.length) + '%', icon: '📊' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', color: '#0f172a', marginBottom: '16px', boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(c => {
          const ss = statStyle[c.status]
          const compColor = c.compliance >= 90 ? '#16a34a' : c.compliance >= 75 ? '#ca8a04' : '#dc2626'
          return (
            <div key={c.id} style={{ background: '#fff', border: `1px solid ${selected?.id === c.id ? '#93c5fd' : '#ebe8df'}`, borderRadius: '12px', padding: '18px 22px', cursor: 'pointer' }} onClick={() => setSelected(selected?.id === c.id ? null : c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>{c.name}</span>
                    <span style={{ ...ss, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '8px' }}>{c.description}</div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>Producer: <strong style={{ color: '#475569' }}>{c.producer}</strong></span>
                    <span>Consumer: <strong style={{ color: '#475569' }}>{c.consumer}</strong></span>
                    <span>Owner: <strong style={{ color: '#475569' }}>{c.owner}</strong></span>
                    <span>Connection: <strong style={{ color: '#475569' }}>{c.connection}</strong></span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '24px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: compColor }}>{c.compliance}%</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>compliance</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{c.checks} checks · {c.failures} failures</div>
                </div>
              </div>

              {/* compliance bar */}
              <div style={{ marginTop: '12px', height: '5px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.compliance}%`, background: compColor, borderRadius: '4px', transition: 'width 0.5s' }} />
              </div>

              {selected?.id === c.id && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #f3f1ea', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>CONTRACT TERMS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {c.terms.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#475569' }}>
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span> {t}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>SLA Target: <strong style={{ color: '#475569' }}>{c.sla}</strong></span>
                    <span>Created: <strong style={{ color: '#475569' }}>{c.created}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
