'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: string | number }
type NavSection = { title: string; items: NavItem[] }

// Inline SVG icons for crisp, modern look
const Icon = ({ d, fill = false }: { d: string; fill?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const icons = {
  overview: <Icon d="M3 12l2-2 4 4 8-8 4 4M3 21h18" />,
  datasets: <Icon d="M3 5c0-1.7 4-3 9-3s9 1.3 9 3v14c0 1.7-4 3-9 3s-9-1.3-9-3V5zm0 0c0 1.7 4 3 9 3s9-1.3 9-3M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />,
  rules: <Icon d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />,
  issues: <Icon d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />,
  anomalies: <Icon d="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  lineage: <Icon d="M5 12h4l3-7 4 14 3-7h4" />,
  catalog: <Icon d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />,
  contracts: <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6M9 9h2" />,
  slas: <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  connections: <Icon d="M9 17H7A5 5 0 117 7h2m6 0h2a5 5 0 010 10h-2M8 12h8" />,
  schedules: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  logs: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  alerts: <Icon d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1" />,
  audit: <Icon d="M9 12l2 2 4-4M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c2.5 0 4.7 1 6.4 2.6" />,
  ai: <Icon d="M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v3H4a2 2 0 000 4h1v3a2 2 0 002 2h2v1a3 3 0 006 0v-1h2a2 2 0 002-2v-3h1a2 2 0 000-4h-1V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM9 11h.01M15 11h.01" />,
  reports: <Icon d="M9 19V6a1 1 0 011-1h4a1 1 0 011 1v13M5 19V11a1 1 0 011-1h3v9M19 19v-5a1 1 0 00-1-1h-3v6M3 19h18" />,
  domains: <Icon d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-9c2.5 3 4 6 4 9s-1.5 6-4 9c-2.5-3-4-6-4-9s1.5-6 4-9zM3 12h18" />,
  settings: <Icon d="M10.3 3.5l-.4 1.7a7.5 7.5 0 00-1.6.7L6.6 5l-1.6 1.6 1 1.7c-.3.5-.5 1-.7 1.6l-1.7.4v2.3l1.7.4c.2.6.4 1.1.7 1.6l-1 1.7L6.6 19l1.7-.9c.5.3 1 .5 1.6.7l.4 1.7h2.3l.4-1.7c.6-.2 1.1-.4 1.6-.7l1.7.9 1.6-1.6-.9-1.7c.3-.5.5-1 .7-1.6l1.7-.4v-2.3l-1.7-.4c-.2-.6-.4-1.1-.7-1.6l.9-1.7-1.6-1.6-1.7.9c-.5-.3-1-.5-1.6-.7l-.4-1.7h-2.3zm1.2 5.5a3 3 0 110 6 3 3 0 010-6z" />,
  architecture: <Icon d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />,
}

const sections: NavSection[] = [
  {
    title: 'MONITOR',
    items: [
      { href: '/', label: 'Overview', icon: icons.overview },
      { href: '/datasets', label: 'Datasets', icon: icons.datasets, badge: '142' },
      { href: '/rules', label: 'Rules', icon: icons.rules, badge: '418' },
      { href: '/issues', label: 'Issues', icon: icons.issues, badge: '23' },
      { href: '/anomalies', label: 'Anomalies', icon: icons.anomalies },
    ]
  },
  {
    title: 'GOVERN',
    items: [
      { href: '/lineage', label: 'Lineage', icon: icons.lineage },
      { href: '/catalog', label: 'Catalog', icon: icons.catalog },
      { href: '/contracts', label: 'Contracts', icon: icons.contracts },
      { href: '/slas', label: 'SLAs', icon: icons.slas },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { href: '/connections', label: 'Connections', icon: icons.connections },
      { href: '/schedules', label: 'Schedules', icon: icons.schedules },
      { href: '/execution-logs', label: 'Execution Logs', icon: icons.logs },
      { href: '/alerts', label: 'Alerts', icon: icons.alerts },
      { href: '/audit-logs', label: 'Audit Logs', icon: icons.audit },
    ]
  },
  {
    title: 'WORKFLOW',
    items: [
      { href: '/reports', label: 'Reports', icon: icons.reports },
      { href: '/domains', label: 'Domain Management', icon: icons.domains },
      { href: '/architecture', label: 'User Guide', icon: icons.architecture },
      { href: '/settings', label: 'Settings', icon: icons.settings },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '240px',
      background: '#ffffff', borderRight: '1px solid #ebe8df',
      display: 'flex', flexDirection: 'column', zIndex: 50, overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #f3f1ea' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Orange EC / infinity logo */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '9px',
            background: '#E8541A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(232,84,26,0.35)',
          }}>
            <svg width="24" height="14" viewBox="0 0 48 28" fill="none">
              {/* Left loop of the EC/infinity shape */}
              <path d="M14 4 C6 4 2 9 2 14 C2 19 6 24 14 24 C19 24 23 21 25 17 C23 21 27 24 34 24 C42 24 46 19 46 14 C46 9 42 4 34 4 C27 4 23 7 25 11 C23 7 19 4 14 4 Z"
                fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Middle bar (the "e" crossbar feel) */}
              <line x1="5" y1="14" x2="22" y2="14" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ color: '#1a1a1a', fontWeight: 700, fontSize: '14px' }}>DataGuard</div>
            <div style={{ color: '#94a3b8', fontSize: '10.5px', letterSpacing: '0.02em' }}>Quality Platform</div>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div style={{ padding: '12px 14px 8px' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 10px', background: '#f9f7f1', border: '1px solid #ebe8df',
          borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
          color: '#475569', textAlign: 'left'
        }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700 }}>A</div>
          <span style={{ flex: 1 }}>Analytics platform</span>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>▾</span>
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '4px 8px 12px', flex: 1 }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: '14px' }}>
            <div style={{
              color: '#94a3b8', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.08em', padding: '8px 10px 6px'
            }}>{section.title}</div>
            {section.items.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px', borderRadius: '7px', marginBottom: '1px',
                    background: active ? '#eef4ff' : 'transparent',
                    color: active ? '#2563eb' : '#475569',
                    fontSize: '13px', fontWeight: active ? 600 : 500,
                    transition: 'all 0.15s', cursor: 'pointer',
                    borderLeft: active ? '2px solid #2563eb' : '2px solid transparent',
                    paddingLeft: active ? '8px' : '10px'
                  }}>
                    <span style={{ display: 'flex', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        background: active ? '#dbeafe' : '#f1f5f9',
                        color: active ? '#2563eb' : '#94a3b8',
                        padding: '1px 7px', borderRadius: '20px',
                        fontSize: '10.5px', fontWeight: 600, minWidth: '20px', textAlign: 'center'
                      }}>{item.badge}</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #f3f1ea', background: '#fafaf5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: '13px'
          }}>B</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>System Admin</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Bhaskar</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
