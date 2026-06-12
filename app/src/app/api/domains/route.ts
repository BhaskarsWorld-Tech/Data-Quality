/**
 * Custom domain definitions.
 *
 * Persisted in ALERTS_KV under "domains-list" on Cloudflare,
 * or data/domains.json on Node. Mirrors the agent-config pattern.
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface CustomDomain {
  id:       string
  name:     string
  icon:     string
  color:    string
  bg:       string
  owner:    string
  /** Substrings to match against UPPERCASE table names. Empty = match nothing. */
  patterns: string[]
}

const KV_KEY = 'domains-list'

async function getKV(): Promise<{ get(k: string, o?: { type?: 'json' | 'text' }): Promise<unknown>; put(k: string, v: string): Promise<void> } | null> {
  try {
    const mod = await import('@opennextjs/cloudflare')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (mod as any).getCloudflareContext?.()?.env
    return env?.ALERTS_KV ?? null
  } catch { return null }
}

async function loadAll(): Promise<CustomDomain[]> {
  const kv = await getKV()
  if (kv) {
    const d = await kv.get(KV_KEY, { type: 'json' }) as CustomDomain[] | null
    return d ?? []
  }
  // Node fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const fp = path.join(process.cwd(), 'data', 'domains.json')
  if (!fs.existsSync(fp)) return []
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) as CustomDomain[] }
  catch { return [] }
}

async function saveAll(domains: CustomDomain[]): Promise<void> {
  const kv = await getKV()
  if (kv) { await kv.put(KV_KEY, JSON.stringify(domains)); return }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'domains.json'), JSON.stringify(domains, null, 2))
}

export async function GET() {
  return NextResponse.json(await loadAll())
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.json() as Partial<CustomDomain>
    if (!incoming.name?.trim()) {
      return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 })
    }
    const domain: CustomDomain = {
      id:       incoming.id ?? `dom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name:     incoming.name.trim(),
      icon:     incoming.icon ?? '📦',
      color:    incoming.color ?? '#6366f1',
      bg:       incoming.bg    ?? '#eef2ff',
      owner:    incoming.owner ?? '',
      patterns: (incoming.patterns ?? []).map(p => p.toUpperCase().trim()).filter(Boolean),
    }
    const all = await loadAll()
    const idx = all.findIndex(d => d.id === domain.id)
    if (idx >= 0) all[idx] = domain          // update
    else          all.push(domain)           // create
    await saveAll(all)
    return NextResponse.json({ ok: true, domain })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id query param required' }, { status: 400 })
    const all = await loadAll()
    const next = all.filter(d => d.id !== id)
    await saveAll(next)
    return NextResponse.json({ ok: true, removed: all.length - next.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
