import { store } from '@/lib/store'
import RulesClient from '@/components/rules/RulesClient'

export default function RulesPage() {
  const rules = store.rules.getAll()
  const connections = store.connections.getAll()
  return <RulesClient initialRules={rules} connections={connections} />
}
