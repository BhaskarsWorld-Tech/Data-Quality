import { NextRequest, NextResponse } from 'next/server'
import { readAgentConfigAsync, writeAgentConfigAsync, resolveApiKeyAsync } from '@/lib/agentConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidKey(k: string): boolean {
  return k.length >= 20 && k.startsWith('sk-ant-')
}

function maskKey(k: string): string {
  if (k.length < 12) return ''
  return k.slice(0, 8) + '…' + k.slice(-4)
}

/** Detect whether a Cloudflare secret/binding is providing the key. */
async function getCfEnvKey(): Promise<string> {
  try {
    const mod = await import('@opennextjs/cloudflare')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (mod as any).getCloudflareContext?.()?.env
    return ((env?.ANTHROPIC_API_KEY as string | undefined) ?? '').trim()
  } catch { return '' }
}

export async function GET() {
  const cfg    = await readAgentConfigAsync()
  const cfKey  = await getCfEnvKey()
  const envKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  const active = await resolveApiKeyAsync()
  const source =
    cfKey  ? 'cloudflare-secret' :
    envKey ? 'env'               :
    cfg.apiKey ? 'ui'            : 'none'
  return NextResponse.json({
    source,
    hasEnvKey:        envKey.length > 0,
    hasCloudflareKey: cfKey.length > 0,
    hasUiKey:         (cfg.apiKey ?? '').length > 0,
    masked:           active ? maskKey(active) : '',
    valid:            isValidKey(active),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json() as { apiKey: string }
    const trimmed = (apiKey ?? '').trim()
    if (trimmed && !isValidKey(trimmed)) {
      return NextResponse.json({ ok: false, error: `Key looks malformed — expected sk-ant-… and at least 20 chars (got ${trimmed.length})` }, { status: 400 })
    }
    const current = await readAgentConfigAsync()
    await writeAgentConfigAsync({ ...current, apiKey: trimmed })
    return NextResponse.json({ ok: true, masked: trimmed ? maskKey(trimmed) : '' })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  await writeAgentConfigAsync({})
  return NextResponse.json({ ok: true })
}
