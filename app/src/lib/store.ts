/**
 * Persistence layer — runtime-aware async store.
 *
 *   • On Node.js → file-backed (data/*.json)
 *   • On Cloudflare Workers → KV-backed via getCloudflareContext()
 *
 * All methods are async to keep one uniform interface across both runtimes.
 */
import { Connection, Rule, Report } from './types'

interface KV {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>
}

interface CFBindings {
  CONNECTIONS_KV?: KV
  RULES_KV?:       KV
  REPORTS_KV?:     KV
  ALERTS_KV?:      KV
  SESSION_KV?:     KV
}

/* ─── Get bindings — works in both OpenNext Cloudflare + dev ───────────── */
async function getKV(name: 'CONNECTIONS_KV' | 'RULES_KV' | 'REPORTS_KV' | 'ALERTS_KV' | 'SESSION_KV'): Promise<KV | null> {
  // First try the OpenNext Cloudflare context (production path)
  try {
    const mod = await import('@opennextjs/cloudflare')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (mod as any).getCloudflareContext?.()
    if (ctx?.env) return (ctx.env as CFBindings)[name] ?? null
  } catch { /* not on Cloudflare or import failed */ }

  // Fallback: globalThis (works in some Worker scenarios)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g[name]) return g[name] as KV
  if (g.__env__?.[name]) return g.__env__[name] as KV

  return null
}

/* ─── Detect runtime at call time ───────────────────────────────────────── */
async function isCloudflare(): Promise<boolean> {
  const kv = await getKV('CONNECTIONS_KV')
  return kv !== null
}

/* ─── Generic KV CRUD ──────────────────────────────────────────────────── */
async function kvGetAll<T>(kv: KV): Promise<T[]> {
  const idx = (await kv.get('_index', { type: 'json' })) as string[] | null
  if (!idx || idx.length === 0) return []
  const rows = await Promise.all(idx.map(id => kv.get(`row:${id}`, { type: 'json' }) as Promise<T | null>))
  const out: T[] = []
  for (const r of rows) if (r !== null) out.push(r as T)
  return out
}
async function kvCreate<T extends { id: string }>(kv: KV, row: T): Promise<T> {
  await kv.put(`row:${row.id}`, JSON.stringify(row))
  const idx = ((await kv.get('_index', { type: 'json' })) as string[] | null) ?? []
  if (!idx.includes(row.id)) {
    idx.push(row.id)
    await kv.put('_index', JSON.stringify(idx))
  }
  return row
}
async function kvUpdate<T extends { id: string }>(kv: KV, id: string, updates: Partial<T>): Promise<T | null> {
  const current = (await kv.get(`row:${id}`, { type: 'json' })) as T | null
  if (!current) return null
  const next = { ...current, ...updates } as T
  await kv.put(`row:${id}`, JSON.stringify(next))
  return next
}
async function kvDelete(kv: KV, id: string): Promise<boolean> {
  const current = await kv.get(`row:${id}`, { type: 'json' })
  if (!current) return false
  await kv.delete(`row:${id}`)
  const idx = ((await kv.get('_index', { type: 'json' })) as string[] | null) ?? []
  await kv.put('_index', JSON.stringify(idx.filter(x => x !== id)))
  return true
}

/* ─── Node file backend ────────────────────────────────────────────────── */
function nodeRead<T>(file: string): T[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const fp = path.join(process.cwd(), 'data', file)
  if (!fs.existsSync(fp)) return []
  return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T[]
}
function nodeWrite<T>(file: string, data: T[]) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2))
}

/* ─── Dispatcher ───────────────────────────────────────────────────────── */
type Coll = 'connections' | 'rules' | 'reports'
const COLL_TO_BINDING: Record<Coll, 'CONNECTIONS_KV' | 'RULES_KV' | 'REPORTS_KV'> = {
  connections: 'CONNECTIONS_KV',
  rules:       'RULES_KV',
  reports:     'REPORTS_KV',
}

async function getAll<T>(coll: Coll): Promise<T[]> {
  const kv = await getKV(COLL_TO_BINDING[coll])
  if (kv) return kvGetAll<T>(kv)
  return nodeRead<T>(`${coll}.json`)
}
async function create<T extends { id: string }>(coll: Coll, row: T): Promise<T> {
  const kv = await getKV(COLL_TO_BINDING[coll])
  if (kv) return kvCreate(kv, row)
  const all = nodeRead<T>(`${coll}.json`)
  all.push(row)
  nodeWrite(`${coll}.json`, all)
  return row
}
async function update<T extends { id: string }>(coll: 'connections' | 'rules', id: string, updates: Partial<T>): Promise<T | null> {
  const kv = await getKV(COLL_TO_BINDING[coll])
  if (kv) return kvUpdate<T>(kv, id, updates)
  const all = nodeRead<T>(`${coll}.json`)
  const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...updates }
  nodeWrite(`${coll}.json`, all)
  return all[idx]
}
async function del(coll: 'connections' | 'rules', id: string): Promise<boolean> {
  const kv = await getKV(COLL_TO_BINDING[coll])
  if (kv) return kvDelete(kv, id)
  const all = nodeRead<{ id: string }>(`${coll}.json`)
  const filtered = all.filter(r => r.id !== id)
  nodeWrite(`${coll}.json`, filtered)
  return filtered.length < all.length
}

/* ─── Public API ───────────────────────────────────────────────────────── */
export const store = {
  connections: {
    getAll:  () => getAll<Connection>('connections'),
    getById: async (id: string) => (await getAll<Connection>('connections')).find(c => c.id === id) ?? null,
    create:  (c: Connection)                       => create('connections', c),
    update:  (id: string, u: Partial<Connection>)  => update<Connection>('connections', id, u),
    delete:  (id: string)                          => del('connections', id),
  },
  rules: {
    getAll:  () => getAll<Rule>('rules'),
    getById: async (id: string) => (await getAll<Rule>('rules')).find(r => r.id === id) ?? null,
    create:  (r: Rule)                             => create('rules', r),
    update:  (id: string, u: Partial<Rule>)        => update<Rule>('rules', id, u),
    delete:  (id: string)                          => del('rules', id),
  },
  reports: {
    getAll: () => getAll<Report>('reports'),
    getLatest: async () => {
      const all = await getAll<Report & { executedAt?: string }>('reports')
      if (all.length === 0) return null
      return all.sort((a, b) => new Date(b.executedAt ?? 0).getTime() - new Date(a.executedAt ?? 0).getTime())[0]
    },
    create: (r: Report) => create('reports', r),
  },
}

/** Exposed for the Snowflake REST client. */
export async function getConnectionsKVBinding(): Promise<KV | null> {
  return getKV('CONNECTIONS_KV')
}
export async function getSessionKVBinding(): Promise<KV | null> {
  return getKV('SESSION_KV')
}
