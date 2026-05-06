import PlaceholderPage from '@/components/PlaceholderPage'
export default function Page() {
  return <PlaceholderPage title="Issues" icon="⚠️" description="Track and resolve all open data quality issues. Assign owners, set priorities, and monitor resolution progress across your data estate." features={["23 open issues (8 critical)","Auto-assign based on dataset owner","Slack & email notifications","Resolution workflow & SLA tracking","Incident history & root cause"]} />
}
