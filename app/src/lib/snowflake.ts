/**
 * Snowflake query helper — server-side only (Node.js runtime).
 * Uses snowflake-sdk with username/password auth.
 */
import snowflake from 'snowflake-sdk'
import { store } from './store'

// Silence the SDK's verbose logging in production
snowflake.configure({ logLevel: 'ERROR' })

type Row = Record<string, unknown>

/** Execute a SQL statement against the saved active Snowflake connection. */
export async function querySnowflake(sql: string, binds?: unknown[]): Promise<Row[]> {
  // Pick the first active snowflake connection
  const all = store.connections.getAll()
  const conn = all.find(c => c.type === 'snowflake' && c.status === 'active')
    ?? all.find(c => c.type === 'snowflake')

  if (!conn) throw new Error('No Snowflake connection configured. Add one in the Connections page.')

  const account = (conn.account as string ?? '').replace(/\.snowflakecomputing\.com$/i, '')

  const sfConn = snowflake.createConnection({
    account,
    username:  conn.username ?? '',
    password:  conn.password as string ?? '',
    warehouse: conn.warehouse ?? '',
    database:  conn.database ?? '',
    schema:    conn.schema   ?? '',
    role:      conn.role     ?? '',
    application: 'DataGuard',
  })

  return new Promise((resolve, reject) => {
    sfConn.connect((err, c) => {
      if (err) return reject(new Error(`Snowflake auth failed: ${err.message}`))

      c.execute({
        sqlText: sql,
        binds:   binds as snowflake.Binds,
        complete: (err2, _stmt, rows) => {
          sfConn.destroy(() => {})
          if (err2) return reject(new Error(`Query error: ${err2.message}`))
          resolve((rows ?? []) as Row[])
        }
      })
    })
  })
}

/** Return metadata + row count for every table / view in the schema. */
export async function getTableMetadata(): Promise<Row[]> {
  return querySnowflake(`
    SELECT
      t.TABLE_NAME,
      t.TABLE_TYPE,
      t.ROW_COUNT,
      t.BYTES,
      t.CREATED,
      t.LAST_ALTERED,
      t.COMMENT,
      t.TABLE_SCHEMA,
      t.TABLE_CATALOG
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_SCHEMA = CURRENT_SCHEMA()
      AND t.TABLE_TYPE IN ('BASE TABLE','VIEW')
    ORDER BY t.TABLE_TYPE DESC, t.TABLE_NAME
  `)
}

/** Return column-level metadata for a single table. */
export async function getColumnMetadata(tableName: string): Promise<Row[]> {
  return querySnowflake(`
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT,
      CHARACTER_MAXIMUM_LENGTH,
      NUMERIC_PRECISION,
      ORDINAL_POSITION,
      COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = CURRENT_SCHEMA()
      AND TABLE_NAME   = ?
    ORDER BY ORDINAL_POSITION
  `, [tableName.toUpperCase()])
}

/** Preview first N rows of a table. */
export async function previewTable(tableName: string, limit = 50): Promise<Row[]> {
  // Snowflake identifiers are case-insensitive; quote to be safe
  return querySnowflake(`SELECT * FROM IDENTIFIER(?) LIMIT ?`, [tableName, limit])
}

/** Run a null-check quality rule against a column and return pass/fail + stats. */
export async function runNullCheck(tableName: string, columnName: string) {
  const rows = await querySnowflake(`
    SELECT
      COUNT(*)                                          AS total_rows,
      COUNT(CASE WHEN "${columnName}" IS NULL THEN 1 END) AS null_count,
      ROUND(COUNT(CASE WHEN "${columnName}" IS NULL THEN 1 END)
            / NULLIF(COUNT(*),0) * 100, 4)              AS null_pct
    FROM IDENTIFIER(?)
  `, [tableName])
  return rows[0]
}
