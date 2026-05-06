'use client'
import { useState } from 'react'
import Link from 'next/link'

const domains = [
  { id: 'd1', name: 'Finance', icon: '💰', color: '#2563eb', owner: 'Bhaskar R.', datasets: 3, rules: 14, score: 74, issues: 5, connection: 'SF_Codex', desc: 'Revenue, payments, and financial reporting data', tables: ['fact_orders', 'fact_payments', 'revenue_by_channel'] },
  { id: 'd2', name: 'Marketing', icon: '📣', color: '#ec4899', owner: 'Priya M.', datasets: 3, rules: 12, score: 87, issues: 2, connection: 'SF_Codex', desc: 'Customer, campaign, and web analytics data', tables: ['dim_customers', 'web_sessions', 'customer_ltv'] },
  { id: 'd3', name: 'Supply Chain', icon: '🚚', color: '#f59e0b', owner: 'Rajan S.', datasets: 1, rules: 5, score: 78, issues: 1, connection: 'SF_Codex', desc: 'Inventory, logistics, and warehouse operations', tables: ['fact_inventory'] },
  { id: 'd4', name: 'Catalog', icon: '📦', color: '#8b5cf6', owner: 'Anil K.', datasets: 1, rules: 4, score: 91, issues: 0, connection: 'SF_Codex', desc: 'Product catalog, SKUs, and pricing data', tables: ['dim_products'] },
  { id: 'd5', name: 'Operations', icon: '⚙️', color: '#14b8a6', owner: 'Rajan S.', datasets: 1, rules: 6, score: 79, issues: 1, connection: 'SF_Codex', desc: 'Returns, fulfillment, and operational metrics', tables: ['fact_returns'] },
]

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 28, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{score}</text>
    </svg>
  )
}

export default function DomainsPage() {
  const [selected, setSelected] = useState<typeof domains[0] | null>(null)

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Domain Management</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Organize and govern data by business domain</p>
        </div>
        <button style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>+ New Domain</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[{ label: 'Total Domains', value: domains.length, icon: '🌐' }, { label: 'Total Datasets', value: domains.reduce((a, d) => a + d.datasets, 0), icon: '📦' }, { label: 'Total Rules', value: domains.reduce((a, d) => a + d.rules, 0), icon: '🛡️' }, { label: 'Avg Quality Score', value: Math.round(domains.reduce((a, d) => a + d.score, 0) / domains.length) + '%', icon: '📊' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: '16px' }}>
        {domains.map(d => (
          <div key={d.id} onClick={() => setSelected(selected?.id === d.id ? null : d)} style={{ background: '#fff', border: `2px solid ${selected?.id === d.id ? d.color : '#ebe8df'}`, borderRadius: '14px', padding: '20px 22px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${d.color}18`, border: `1px solid ${d.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>{d.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a1a' }}>{d.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Owner: {d.owner}</div>
                </div>
              </div>
              <ScoreRing score={d.score} color={d.score >= 90 ? '#16a34a' : d.score >= 80 ? '#ca8a04' : '#dc2626'} />
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.5' }}>{d.desc}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
              {[{ label: 'Datasets', value: d.datasets }, { label: 'Rules', value: d.rules }, { label: 'Issues', value: d.issues }].map(m => (
                <div key={m.label} style={{ background: '#fafaf9', borderRadius: '8px', padding: '8px', textAlign: 'center', border: '1px solid #ebe8df' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: m.label === 'Issues' && m.value > 0 ? '#dc2626' : '#1a1a1a' }}>{m.value}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {selected?.id === d.id && (
              <div style={{ borderTop: '1px solid #f3f1ea', paddingTop: '12px' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>TABLES IN THIS DOMAIN</div>
                {d.tables.map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: d.color, fontSize: '12px' }}>▸</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#475569' }}>{t}</span>
                    <Link href="/catalog" style={{ marginLeft: 'auto', fontSize: '11px', color: '#2563eb', textDecoration: 'none' }}>View in Catalog →</Link>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <Link href="/issues" style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', fontSize: '12px', fontWeight: 500, textAlign: 'center', textDecoration: 'none' }}>View Issues</Link>
                  <Link href="/rules" style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '1px solid #dbeafe', background: '#fff', color: '#2563eb', fontSize: '12px', fontWeight: 500, textAlign: 'center', textDecoration: 'none' }}>View Rules</Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
