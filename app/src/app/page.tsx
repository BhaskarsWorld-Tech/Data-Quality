import { store } from '@/lib/store'
import Dashboard from '@/components/dashboard/Dashboard'

export default function HomePage() {
  const connections = store.connections.getAll()
  const rules = store.rules.getAll()
  const latestReport = store.reports.getLatest()

  const stats = {
    totalRules: rules.length,
    enabledRules: rules.filter(r => r.enabled).length,
    totalConnections: connections.length,
    activeConnections: connections.filter(c => c.status === 'active').length,
    overallScore: latestReport?.overallScore || 0,
    passed: latestReport?.passed || 0,
    failed: latestReport?.failed || 0,
    warnings: latestReport?.warnings || 0,
    totalChecks: latestReport?.totalChecks || 0,
    trend: latestReport?.trend || [],
    recentChecks: latestReport?.results?.slice(0, 5) || [],
    lastRunAt: latestReport?.executedAt || null
  }

  return <Dashboard stats={stats} />
}
