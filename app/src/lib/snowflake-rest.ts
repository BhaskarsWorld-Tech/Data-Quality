/**
 * Snowflake REST client that runs inside Cloudflare Workers.
 *
 * Why this exists:
 *   The official `snowflake-sdk` uses Node-native modules (`net`, `tls`, `fs`)
 *   that aren't supported in the Workers runtime. This module re-implements
 *   the subset of Snowflake we need (auth + execute statement + result-scan)
 *   using only `fetch` + WebCrypto, both first-class on Workers.
 *
 * Auth strategy:
 *   1. Try cached session token (kept in SESSION_KV for 3.5 h).
 *   2. On miss, POST to `/session/v1/login-request` with username + password.
 *   3. Cache the returned `data.token`.
 *
 * All exported function signatures match `src/lib/snowflake.ts` (Node version)
 * so the rest of the app doesn't need to change — `src/lib/snowflake.ts`
 * re-exports from this file when `process.env.CF_PAGES === '1'`.
 */

import { store, getSessionKVBinding } from './store'

type Row = Record<string, unknown>


/* ─── connection resolution (KV-backed) ─────────────────────────────────── */

type Connection = {
  id:        string
  name:      string
  type:      string
  account:   string
  username:  string
  password?: string
  warehouse: string
  database:  string
  schema:    string
  role:      string
  status:    string
}

// Coerce the canonical types.Connection (which has optional fields for
// non-Snowflake types) into the strict shape used here.
function asConn(c: unknown): Connection {
  const x = c as Record<string, unknown>
  return {
    id:        (x.id        as string) ?? '',
    name:      (x.name      as string) ?? '',
    type:      (x.type      as string) ?? '',
    account:   (x.account   as string) ?? '',
    username:  (x.username  as string) ?? '',
    password:  x.password as string | undefined,
    warehouse: (x.warehouse as string) ?? '',
    database:  (x.database  as string) ?? '',
    schema:    (x.schema    as string) ?? '',
    role:      (x.role      as string) ?? '',
    status:    (x.status    as string) ?? '',
  }
}

async function loadAllConnections(): Promise<Array<Record<string, unknown>>> {
  return await store.connections.getAll() as unknown as Array<Record<string, unknown>>
}

async function resolveConnection(connectionId?: string): Promise<Connection> {
  const all = await loadAllConnections()
  if (connectionId) {
    const found = all.find(c => c.id === connectionId)
    if (!found) throw new Error(`Connection ${connectionId} not found.`)
    return asConn(found)
  }
  const c = all.find(c => c.type === 'snowflake' && c.status === 'active')
         ?? all.find(c => c.type === 'snowflake')
  if (!c) throw new Error('No Snowflake connection configured.')
  return asConn(c)
}

/* ─── session-token auth ────────────────────────────────────────────────── */

interface LoginResponse { data?: { token?: string; masterToken?: string }; success: boolean; message?: string }

function accountHost(account: string): string {
  // "FPUYJEJ-ISB99901.snowflakecomputing.com" or just "FPUYJEJ-ISB99901"
  return account.replace(/\.snowflakecomputing\.com$/i, '')
}

async function login(conn: Connection): Promise<string> {
  const host = accountHost(conn.account)

  // Pass warehouse/database/schema/role as query params so the session is
  // initialized with the correct context — otherwise downstream queries
  // fail with "this session does not have a current database".
  const qs = new URLSearchParams()
  if (conn.warehouse) qs.set('warehouse',   conn.warehouse)
  if (conn.database)  qs.set('databaseName', conn.database)
  if (conn.schema)    qs.set('schemaName',   conn.schema)
  if (conn.role)      qs.set('roleName',     conn.role)
  const url = `https://${host}.snowflakecomputing.com/session/v1/login-request?${qs.toString()}`

  const body = {
    data: {
      ACCOUNT_NAME:           host.split('.')[0],
      LOGIN_NAME:             conn.username,
      PASSWORD:               conn.password,
      CLIENT_APP_ID:          'DataGuard',
      CLIENT_APP_VERSION:     '1.0.0',
      SESSION_PARAMETERS:     {
        CLIENT_PREFETCH_THREADS: 1,
      },
      CLIENT_ENVIRONMENT: {
        APPLICATION: 'DataGuard',
        OS:          'cloudflare-workers',
        OS_VERSION:  '1',
        warehouse:   conn.warehouse,
        database:    conn.database,
        schema:      conn.schema,
        role:        conn.role,
      },
    },
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':         'application/json',
      'Accept':               'application/snowflake',
      'User-Agent':           'DataGuard/1.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Snowflake login failed: HTTP ${res.status} ${await res.text()}`)
  const json = await res.json() as LoginResponse
  if (!json.success || !json.data?.token) throw new Error(`Snowflake login failed: ${json.message ?? 'no token'}`)
  return json.data.token
}

function sessionCacheKey(conn: Connection): string {
  // v4 — context (wh/db/schema/role) baked into the key so the runtime
  // warehouse/DB/schema switcher invalidates the cached token automatically.
  const ctx = `${conn.warehouse}|${conn.database}|${conn.schema}|${conn.role}`
  return `sf-session-v4:${conn.id}:${ctx}`
}

async function invalidateSessionCache(conn: Connection): Promise<void> {
  const kv = await getSessionKVBinding()
  if (!kv) return
  try { await kv.delete(sessionCacheKey(conn)) }
  catch { /* best-effort */ }
}

async function getSessionToken(conn: Connection, forceFresh = false): Promise<string> {
  const cacheKey = sessionCacheKey(conn)
  const kv       = await getSessionKVBinding()

  if (!forceFresh && kv) {
    const cached = await kv.get(cacheKey, { type: 'text' }) as string | null
    if (cached) return cached
  }

  const token = await login(conn)
  // Initialize the session context — query-body warehouse/db/schema/role
  // are sometimes ignored, so we explicitly USE them once after auth.
  await initSessionContext(token, conn)

  if (kv) {
    // Snowflake session tokens live ~4 h idle. Cache for 1 h so a 2-h-old
    // cached token doesn't surface "session expired" to the user often.
    // Auto-retry handles the rare case where the cache outlives the session.
    await kv.put(cacheKey, token, { expirationTtl: 3600 })
  }
  return token
}

/** Run USE statements to set the session's current warehouse/db/schema/role. */
async function initSessionContext(token: string, conn: Connection): Promise<void> {
  const host = accountHost(conn.account)
  const useStatements: string[] = []
  if (conn.role)      useStatements.push(`USE ROLE "${conn.role}"`)
  if (conn.warehouse) useStatements.push(`USE WAREHOUSE "${conn.warehouse}"`)
  if (conn.database)  useStatements.push(`USE DATABASE "${conn.database}"`)
  if (conn.schema)    useStatements.push(`USE SCHEMA "${conn.schema}"`)
  if (useStatements.length === 0) return

  // Multi-statement batch: combine all USE calls into one request.
  const sql = useStatements.join(';\n') + ';'
  const url = `https://${host}.snowflakecomputing.com/queries/v1/query-request?requestId=${crypto.randomUUID()}`

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/snowflake',
      'User-Agent':    'DataGuard/1.0.0',
      'Authorization': `Snowflake Token="${token}"`,
    },
    body: JSON.stringify({
      sqlText:    sql,
      asyncExec:  false,
      sequenceId: 1,
      querySubmissionTime: Date.now(),
      parameters: {
        MULTI_STATEMENT_COUNT: String(useStatements.length),
        QUERY_TAG:             'DataGuard-session-init',
      },
    }),
  })

  if (!res.ok) {
    // Non-fatal — log and continue. Query may still work if account has defaults.
    const txt = await res.text().catch(() => '')
    console.warn(`Snowflake session init failed: HTTP ${res.status} ${txt.slice(0, 200)}`)
  }
}

/* ─── statement execution ───────────────────────────────────────────────── */

interface ExecuteResponse {
  data?: {
    rowtype?: Array<{ name: string; type?: string; scale?: number }>
    rowset?:  Array<Array<unknown>>
    queryId?: string
    chunks?:  Array<{ url: string; rowCount: number }>
    qrmk?:    string
    chunkHeaders?: Record<string, string>
  }
  code?:    string
  message?: string
  success: boolean
}

/** Snowflake REST returns every value as a string — coerce based on column type. */
function coerceValue(raw: unknown, type?: string): unknown {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return raw
  const t = (type ?? '').toUpperCase()
  if (t === 'FIXED' || t === 'REAL' || t === 'INTEGER' || t === 'BIGINT') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  if (t === 'BOOLEAN') return raw === 'true' || raw === '1'
  // TIMESTAMP_NTZ, DATE etc. — leave as string for downstream formatting.
  return raw
}

/** Patterns Snowflake returns when the session token is no longer valid. */
function isSessionExpired(text: string): boolean {
  const s = (text ?? '').toLowerCase()
  return s.includes('session has expired') ||
         s.includes('session no longer exists') ||
         s.includes('authentication token has expired') ||
         s.includes('invalid session') ||
         s.includes('390112') ||  // session expired error code
         s.includes('390195') ||  // master token expired
         s.includes('390104')     // user requires authentication
}

async function attemptQuery(sql: string, binds: unknown[] | undefined, conn: Connection, forceFresh: boolean): Promise<{ ok: boolean; json?: ExecuteResponse; rawText?: string; status: number }> {
  const host  = accountHost(conn.account)
  const token = await getSessionToken(conn, forceFresh)
  const url   = `https://${host}.snowflakecomputing.com/queries/v1/query-request?requestId=${crypto.randomUUID()}`

  const body = {
    sqlText:      sql,
    asyncExec:    false,
    sequenceId:   1,
    querySubmissionTime: Date.now(),
    bindings:     binds ? bindsToParams(binds) : undefined,
    parameters: {
      QUERY_TAG:               'DataGuard',
      DATE_OUTPUT_FORMAT:      'YYYY-MM-DD',
      TIMESTAMP_OUTPUT_FORMAT: 'YYYY-MM-DD HH24:MI:SS.FF',
    },
    warehouse: conn.warehouse,
    database:  conn.database,
    schema:    conn.schema,
    role:      conn.role,
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/snowflake',
      'User-Agent':    'DataGuard/1.0.0',
      'Authorization': `Snowflake Token="${token}"`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return { ok: false, rawText: txt, status: res.status }
  }
  const json = await res.json() as ExecuteResponse
  return { ok: true, json, status: res.status }
}

async function executeStatement(sql: string, binds: unknown[] | undefined, conn: Connection): Promise<Row[]> {
  // First attempt — use cached token if available
  let result = await attemptQuery(sql, binds, conn, false)

  // Retry once with a freshly-minted token if the failure looks like session expiry
  const errBody = result.rawText ?? (result.json?.success === false ? `${result.json.code ?? ''} ${result.json.message ?? ''}` : '')
  if ((!result.ok || result.json?.success === false) && isSessionExpired(errBody)) {
    console.warn('Snowflake session expired — invalidating cache and retrying with fresh login')
    await invalidateSessionCache(conn)
    result = await attemptQuery(sql, binds, conn, true)
  }

  if (!result.ok) throw new Error(`Snowflake query failed: HTTP ${result.status} ${(result.rawText ?? '').slice(0, 300)}`)
  const json = result.json!
  if (!json.success) throw new Error(`Snowflake query error: ${json.message ?? json.code ?? 'unknown'}`)

  const rowtype = json.data?.rowtype ?? []
  const cols    = rowtype.map(c => c.name)
  const types   = rowtype.map(c => c.type)
  const inline = json.data?.rowset    ?? []
  let allRows = inline

  // Fetch chunked results when present
  for (const chunk of json.data?.chunks ?? []) {
    const cRes = await fetch(chunk.url, {
      headers: json.data?.chunkHeaders ?? {},
    })
    if (cRes.ok) {
      const cRows = await cRes.json() as Array<Array<unknown>>
      allRows = allRows.concat(cRows)
    }
  }

  return allRows.map(r => Object.fromEntries(cols.map((c, i) => [c, coerceValue(r[i], types[i])])) as Row)
}

function bindsToParams(binds: unknown[]): Record<string, { type: string; value: string }> {
  const out: Record<string, { type: string; value: string }> = {}
  binds.forEach((b, i) => {
    const idx  = String(i + 1)
    let type   = 'TEXT'
    let value  = String(b)
    if (typeof b === 'number') { type = 'FIXED'; value = String(b) }
    else if (b === null)       { type = 'TEXT';  value = '' }
    out[idx] = { type, value }
  })
  return out
}

/* ─── public API (mirrors src/lib/snowflake.ts) ─────────────────────────── */

export async function querySnowflake(sql: string, binds?: unknown[], connectionId?: string): Promise<Row[]> {
  const conn = await resolveConnection(connectionId)
  return executeStatement(sql, binds, conn)
}

export async function getTableMetadata(connectionId?: string): Promise<Row[]> {
  return querySnowflake(`
    SELECT t.TABLE_NAME, t.TABLE_TYPE, t.ROW_COUNT, t.BYTES,
           t.CREATED, t.LAST_ALTERED, t.COMMENT,
           t.TABLE_SCHEMA, t.TABLE_CATALOG
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_SCHEMA = CURRENT_SCHEMA()
      AND t.TABLE_TYPE IN ('BASE TABLE','VIEW','MATERIALIZED VIEW')
    ORDER BY t.TABLE_TYPE DESC, t.TABLE_NAME
  `, undefined, connectionId)
}

export async function getColumnMetadata(tableName: string, connectionId?: string): Promise<Row[]> {
  return querySnowflake(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
           CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, ORDINAL_POSITION, COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, [tableName.toUpperCase()], connectionId)
}

export async function previewTable(tableName: string, limit = 50, connectionId?: string): Promise<Row[]> {
  return querySnowflake(`SELECT * FROM IDENTIFIER(?) LIMIT ?`, [tableName, limit], connectionId)
}

export async function getViewDefinitions(connectionId?: string): Promise<Row[]> {
  return querySnowflake(`
    SELECT TABLE_NAME, VIEW_DEFINITION
    FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_SCHEMA = CURRENT_SCHEMA()
  `, undefined, connectionId)
}

export async function getMaterializedViewDefinitions(connectionId?: string): Promise<Row[]> {
  try {
    const mvs = await querySnowflake(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_TYPE = 'MATERIALIZED VIEW'
    `, undefined, connectionId)
    const out: Row[] = []
    for (const r of mvs) {
      try {
        const ddl = await querySnowflake(
          `SELECT GET_DDL('materialized_view', CURRENT_DATABASE() || '.' || CURRENT_SCHEMA() || '.' || ?) AS DDL`,
          [r.TABLE_NAME as string], connectionId
        )
        out.push({ TABLE_NAME: r.TABLE_NAME, VIEW_DEFINITION: ddl[0]?.DDL ?? '' })
      } catch { /* skip */ }
    }
    return out
  } catch { return [] }
}

export async function getConnectionSummary(connectionId?: string) {
  const c = await resolveConnection(connectionId)
  return {
    id: c.id, name: c.name, warehouse: c.warehouse, schema: c.schema,
    database: c.database, type: c.type, status: c.status,
  }
}

/* ─── ad-hoc discovery (no saved connection required) ────────────────────── */

/** Build a transient Connection object from inline creds — used at "Add Connection" time. */
function makeAdhocConn(creds: {
  account: string; username: string; password: string;
  role?: string; warehouse?: string; database?: string; schema?: string;
}): Connection {
  return {
    id:        `adhoc-${crypto.randomUUID()}`,
    name:      'adhoc-discovery',
    type:      'snowflake',
    account:   creds.account,
    username:  creds.username,
    password:  creds.password,
    warehouse: creds.warehouse ?? '',
    database:  creds.database  ?? '',
    schema:    creds.schema    ?? '',
    role:      creds.role      ?? '',
    status:    'active',
  }
}

/**
 * Authenticate with inline credentials and return the warehouses + databases
 * the user can see. Optionally also returns schemas for a chosen database.
 *
 * Used by the "Discover" button in the Add-Connection modal so the user can
 * pick from real warehouses/DBs/schemas instead of typing them blind.
 */
export async function discoverSnowflakeResources(creds: {
  account: string; username: string; password: string; role?: string;
  database?: string;   // when present → also fetch schemas in this DB
}): Promise<{ warehouses: string[]; databases: string[]; schemas?: string[] }> {
  const conn = makeAdhocConn(creds)

  // SHOW WAREHOUSES + SHOW DATABASES don't require a current database, so
  // they work even when the user hasn't picked one yet.
  const [whRows, dbRows] = await Promise.all([
    executeStatement('SHOW WAREHOUSES', undefined, conn).catch(() => [] as Row[]),
    executeStatement('SHOW DATABASES',  undefined, conn).catch(() => [] as Row[]),
  ])

  const warehouses = whRows.map(r => String(r.name ?? r.NAME ?? '')).filter(Boolean).sort()
  const databases  = dbRows.map(r => String(r.name ?? r.NAME ?? '')).filter(Boolean).sort()

  let schemas: string[] | undefined
  if (creds.database) {
    try {
      const scRows = await executeStatement(`SHOW SCHEMAS IN DATABASE "${creds.database}"`, undefined, conn)
      schemas = scRows.map(r => String(r.name ?? r.NAME ?? '')).filter(Boolean)
        .filter(s => s !== 'INFORMATION_SCHEMA')
        .sort()
    } catch { schemas = [] }
  }

  return { warehouses, databases, schemas }
}

