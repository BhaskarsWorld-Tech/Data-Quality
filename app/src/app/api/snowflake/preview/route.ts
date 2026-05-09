import { NextRequest, NextResponse } from 'next/server'
import { previewTable } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams
    const table = params.get('table')
    const limit = parseInt(params.get('limit') ?? '50', 10)
    if (!table) return NextResponse.json({ error: 'table param required' }, { status: 400 })
    const rows = await previewTable(table, limit)
    return NextResponse.json({ rows, count: rows.length })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
