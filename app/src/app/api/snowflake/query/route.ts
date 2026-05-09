import { NextRequest, NextResponse } from 'next/server'
import { querySnowflake } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { sql, binds } = await req.json()
    if (!sql) return NextResponse.json({ error: 'sql is required' }, { status: 400 })
    const rows = await querySnowflake(sql, binds)
    return NextResponse.json({ rows, count: rows.length })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
