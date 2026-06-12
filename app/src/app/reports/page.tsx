import { store } from '@/lib/store'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const reports = await store.reports.getAll()
  return <ReportsClient initialReports={reports} />
}
