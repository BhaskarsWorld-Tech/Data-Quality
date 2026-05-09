import { NextResponse } from 'next/server'
import { getTableMetadata } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tables = await getTableMetadata()
    return NextResponse.json({ tables })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
