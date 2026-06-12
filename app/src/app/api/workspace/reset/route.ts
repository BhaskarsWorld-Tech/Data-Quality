import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ResetRequest {
  scope:   ('connections' | 'rules' | 'reports' | 'alerts' | 'security')[]
  confirm: string  // must equal "RESET"
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResetRequest
    if (body.confirm !== 'RESET') {
      return NextResponse.json({ ok: false, error: 'Type RESET to confirm' }, { status: 400 })
    }

    const dataDir = path.join(process.cwd(), 'data')
    const FILES: Record<string, string> = {
      connections: 'connections.json',
      rules:       'rules.json',
      reports:     'reports.json',
      alerts:      'alerts-config.json',
      security:    'security-config.json',
    }
    const cleared: string[] = []
    const skipped: string[] = []

    for (const scope of body.scope) {
      const file = FILES[scope]
      if (!file) { skipped.push(scope); continue }
      const fp = path.join(dataDir, file)
      if (fs.existsSync(fp)) {
        // Reset to empty array (or empty object for config files)
        const isConfig = file.endsWith('-config.json')
        fs.writeFileSync(fp, isConfig ? '{}' : '[]')
        cleared.push(scope)
      } else {
        skipped.push(scope)
      }
    }

    return NextResponse.json({ ok: true, cleared, skipped, ts: new Date().toISOString() })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
