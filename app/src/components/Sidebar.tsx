'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/connections', label: 'Connections', icon: '🔌' },
  { href: '/rules', label: 'Rules', icon: '📋' },
  { href: '/reports', label: 'Reports', icon: '📈' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '240px',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      boxShadow: '4px 0 24px rgba(0,0,0,0.15)'
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
          }}>🛡️</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>DataGuard</div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Quality Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <div style={{ color: '#475569', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', padding: '4px 8px 8px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px', marginBottom: '2px',
                background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))' : 'transparent',
                border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                color: active ? '#a5b4fc' : '#94a3b8',
                fontSize: '14px', fontWeight: active ? 600 : 400,
                transition: 'all 0.2s', cursor: 'pointer'
              }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* AI Badge */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px' }}>🤖</span>
            <span style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 600 }}>AI Agent</span>
            <div style={{ marginLeft: 'auto', width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          </div>
          <div style={{ color: '#64748b', fontSize: '11px' }}>Click the 🤖 button to chat</div>
        </div>
      </div>
    </aside>
  )
}
