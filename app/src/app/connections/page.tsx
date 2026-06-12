import { store } from '@/lib/store'
import ConnectionsClient from '@/components/connections/ConnectionsClient'

export default async function ConnectionsPage() {
  const connections = await store.connections.getAll()
  return <ConnectionsClient initialConnections={connections} />
}
