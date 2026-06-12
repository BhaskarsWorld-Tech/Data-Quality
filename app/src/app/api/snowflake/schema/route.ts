import { NextRequest, NextResponse } from 'next/server'
import { getTableMetadata, getColumnMetadata } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const connectionId = new URL(req.url).searchParams.get('connectionId') ?? undefined
    const tables = await getTableMetadata(connectionId)
    const withColumns = await Promise.all(
      tables.map(async (t) => {
        try {
          const cols = await getColumnMetadata(t.TABLE_NAME as string, connectionId)
          return {
            name:    t.TABLE_NAME as string,
            type:    (t.TABLE_TYPE as string) ?? 'TABLE',
            rows:    (t.ROW_COUNT  as number) ?? 0,
            bytes:   (t.BYTES      as number) ?? 0,
            created: (t.CREATED      as string) ?? '',
            updated: (t.LAST_ALTERED as string) ?? '',
            columns: cols.map(c => ({
              name:     c.COLUMN_NAME    as string,
              type:     c.DATA_TYPE      as string,
              nullable: c.IS_NULLABLE    as string,
              position: c.ORDINAL_POSITION as number,
            }))
          }
        } catch {
          return {
            name:    t.TABLE_NAME as string,
            type:    (t.TABLE_TYPE as string) ?? 'TABLE',
            rows:    (t.ROW_COUNT  as number) ?? 0,
            bytes:   (t.BYTES      as number) ?? 0,
            created: '', updated: '', columns: [],
          }
        }
      })
    )
    return NextResponse.json({ tables: withColumns })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
