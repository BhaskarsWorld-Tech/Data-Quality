import { NextResponse } from 'next/server'
import { getTableMetadata, previewTable } from '@/lib/snowflake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tables = await getTableMetadata()

    // For every table that has rows, fetch up to 200 rows in parallel
    const withData = await Promise.all(
      tables.map(async (t) => {
        const rowCount = (t.ROW_COUNT as number) ?? 0
        let preview: Record<string, unknown>[] = []
        if (rowCount > 0) {
          try {
            preview = await previewTable(t.TABLE_NAME as string, 200)
          } catch {
            preview = []
          }
        }
        return { ...t, preview }
      })
    )

    const totalRows   = tables.reduce((s, t) => s + ((t.ROW_COUNT as number) ?? 0), 0)
    const totalBytes  = tables.reduce((s, t) => s + ((t.BYTES     as number) ?? 0), 0)
    const populated   = tables.filter(t => ((t.ROW_COUNT as number) ?? 0) > 0).length
    const empty       = tables.length - populated

    return NextResponse.json({
      summary: {
        tableCount: tables.length,
        populated,
        empty,
        totalRows,
        totalBytes,
      },
      tables: withData,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
