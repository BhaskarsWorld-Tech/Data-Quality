import { NextRequest, NextResponse } from 'next/server'
import { readSecurityConfig, writeSecurityConfig, computeSecurityScore, SecurityConfig } from '@/lib/securityConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const cfg = readSecurityConfig()
  const { score, breakdown } = computeSecurityScore(cfg)
  return NextResponse.json({ config: cfg, score, breakdown })
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.json() as Partial<SecurityConfig>
    const current  = readSecurityConfig()
    const merged: SecurityConfig = {
      authentication: { ...current.authentication, ...(incoming.authentication ?? {}) },
      session:        { ...current.session,        ...(incoming.session        ?? {}) },
      access:         { ...current.access,         ...(incoming.access         ?? {}) },
      dataProtection: { ...current.dataProtection, ...(incoming.dataProtection ?? {}) },
      api:            { ...current.api,            ...(incoming.api            ?? {}) },
      audit:          { ...current.audit,          ...(incoming.audit          ?? {}) },
      compliance:     { ...current.compliance,     ...(incoming.compliance     ?? {}) },
    }
    writeSecurityConfig(merged)
    const { score } = computeSecurityScore(merged)
    return NextResponse.json({ ok: true, score })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
