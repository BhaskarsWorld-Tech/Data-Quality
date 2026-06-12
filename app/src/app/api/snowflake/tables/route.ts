import { NextRequest, NextResponse } from 'next/server'
import { getTableMetadata } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const connectionId = new URL(req.url).searchParams.get('connectionId') ?? undefined
    const tables = await getTableMetadata(connectionId)
    return NextResponse.json({ tables })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
