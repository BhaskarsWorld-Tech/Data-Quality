import { NextRequest, NextResponse } from 'next/server'
import { getColumnMetadata } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const table = new URL(req.url).searchParams.get('table')
    if (!table) return NextResponse.json({ error: 'table param required' }, { status: 400 })
    const columns = await getColumnMetadata(table)
    return NextResponse.json({ columns })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
