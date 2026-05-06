import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import AgentChat from '@/components/agent/AgentChat'

export const metadata: Metadata = {
  title: 'DataGuard - Data Quality Platform',
  description: 'AI-powered data quality monitoring and management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', minHeight: '100vh', background: '#fdfcf7' }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: '240px', minHeight: '100vh', overflow: 'auto' }}>
          {children}
        </main>
        <AgentChat />
      </body>
    </html>
  )
}
