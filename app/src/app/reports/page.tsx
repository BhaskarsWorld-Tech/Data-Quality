import { store } from '@/lib/store'
import ReportsClient from '@/components/reports/ReportsClient'

export default function ReportsPage() {
  const reports = store.reports.getAll()
  return <ReportsClient initialReports={reports} />
}
