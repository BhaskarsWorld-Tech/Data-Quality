import { store } from '@/lib/store'
import ConnectionsClient from '@/components/connections/ConnectionsClient'

export default function ConnectionsPage() {
  const connections = store.connections.getAll()
  return <ConnectionsClient initialConnections={connections} />
}
