import { NextRequest, NextResponse } from 'next/server'
import { getColumnMetadata } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const table = url.searchParams.get('table')
    const connectionId = url.searchParams.get('connectionId') ?? undefined
    if (!table) return NextResponse.json({ error: 'table param required' }, { status: 400 })
    const columns = await getColumnMetadata(table, connectionId)
    return NextResponse.json({ columns })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
