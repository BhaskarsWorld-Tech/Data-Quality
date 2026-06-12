/**
 * Anthropic API key resolution + persistence.
 *
 * Resolution order (first non-empty wins):
 *   1. Cloudflare Workers secret (env.ANTHROPIC_API_KEY via getCloudflareContext)
 *   2. process.env.ANTHROPIC_API_KEY (Node local dev)
 *   3. UI-saved key persisted in:
 *      • Cloudflare → ALERTS_KV under key "agent-config"
 *      • Node       → data/agent-config.json
 */

interface AgentConfig { apiKey?: string }

/** Try to grab the Cloudflare env via OpenNext's context helper. */
async function getCfEnv(): Promise<Record<string, unknown> | null> {
  try {
    const mod = await import('@opennextjs/cloudflare')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (mod as any).getCloudflareContext?.()
    return ctx?.env ?? null
  } catch { return null }
}

/* ─── Node file backend (local dev) ────────────────────────────────────── */
function nodeRead(): AgentConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const fp = path.join(process.cwd(), 'data', 'agent-config.json')
  if (!fs.existsSync(fp)) return {}
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) as AgentConfig } catch { return {} }
}
function nodeWrite(cfg: AgentConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs   = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'agent-config.json'), JSON.stringify(cfg, null, 2))
}

/* ─── KV backend (Cloudflare) ──────────────────────────────────────────── */
interface KV {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<unknown>
  put(key: string, value: string): Promise<void>
}
const KV_KEY = 'agent-config'
async function kvRead(kv: KV): Promise<AgentConfig> {
  try { return ((await kv.get(KV_KEY, { type: 'json' })) as AgentConfig) ?? {} }
  catch { return {} }
}
async function kvWrite(kv: KV, cfg: AgentConfig): Promise<void> {
  await kv.put(KV_KEY, JSON.stringify(cfg))
}

/* ─── Public async API ─────────────────────────────────────────────────── */
export async function readAgentConfigAsync(): Promise<AgentConfig> {
  const env = await getCfEnv()
  if (env?.ALERTS_KV) return kvRead(env.ALERTS_KV as KV)
  return nodeRead()
}

export async function writeAgentConfigAsync(cfg: AgentConfig): Promise<void> {
  const env = await getCfEnv()
  if (env?.ALERTS_KV) return kvWrite(env.ALERTS_KV as KV, cfg)
  return nodeWrite(cfg)
}

/** Resolve the active API key. Async because KV reads are async on Workers. */
export async function resolveApiKeyAsync(): Promise<string> {
  // 1. Cloudflare secret (production)
  const env = await getCfEnv()
  const cfKey = (env?.ANTHROPIC_API_KEY as string | undefined)?.trim()
  if (cfKey) return cfKey

  // 2. Node env var (local dev)
  const envKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (envKey) return envKey

  // 3. Persisted UI-saved key
  const cfg = await readAgentConfigAsync()
  return (cfg.apiKey ?? '').trim()
}

/* ─── Backwards-compat sync wrappers (Node-only paths) ─────────────────── */
export function readAgentConfig(): AgentConfig { return nodeRead() }
export function writeAgentConfig(cfg: AgentConfig): void { return nodeWrite(cfg) }

/** Sync version — works on Node but always returns '' on Cloudflare. */
export function resolveApiKey(): string {
  const fromEnv = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (fromEnv.length > 0) return fromEnv
  try {
    return (nodeRead().apiKey ?? '').trim()
  } catch { return '' }
}
