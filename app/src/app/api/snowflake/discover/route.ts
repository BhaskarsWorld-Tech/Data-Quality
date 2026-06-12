import { NextRequest, NextResponse } from 'next/server'
import { discoverSnowflakeResources, querySnowflake } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>
const pick = (rows: Row[]): string[] =>
  rows.map(r => String(r.name ?? r.NAME ?? '')).filter(Boolean)

/**
 * GET /api/snowflake/discover?connectionId=X[&database=Y]
 *
 * Lists the warehouses + databases (and optionally schemas inside `database`)
 * the saved connection can see. Used by the global ConnectionToolbar so the
 * user can switch warehouse / DB / schema at runtime without editing the
 * connection.
 */
export async function GET(req: NextRequest) {
  try {
    const url          = new URL(req.url)
    const connectionId = url.searchParams.get('connectionId') ?? undefined
    const database     = url.searchParams.get('database')     ?? ''

    const [whRows, dbRows] = await Promise.all([
      querySnowflake('SHOW WAREHOUSES', undefined, connectionId).catch(() => [] as Row[]),
      querySnowflake('SHOW DATABASES',  undefined, connectionId).catch(() => [] as Row[]),
    ])

    const warehouses = pick(whRows).sort()
    const databases  = pick(dbRows).sort()

    let schemas: string[] | undefined
    if (database) {
      try {
        const scRows = await querySnowflake(`SHOW SCHEMAS IN DATABASE "${database}"`, undefined, connectionId)
        schemas = pick(scRows).filter(s => s !== 'INFORMATION_SCHEMA').sort()
      } catch { schemas = [] }
    }

    return NextResponse.json({ warehouses, databases, schemas })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/snowflake/discover
 *
 * Body: { account, username, password, role?, database? }
 *
 * Authenticates with the supplied creds and returns the warehouses + databases
 * the user can see. If `database` is provided, also returns the schemas inside
 * that database. Used by the Add-Connection modal so the user can pick
 * warehouse/db/schema from real lists instead of typing them blind.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      account?: string; username?: string; password?: string;
      role?: string; database?: string;
    }
    const { account, username, password, role, database } = body
    if (!account || !username || !password) {
      return NextResponse.json(
        { error: 'account, username and password are required' },
        { status: 400 },
      )
    }
    const result = await discoverSnowflakeResources({
      account, username, password, role, database,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
