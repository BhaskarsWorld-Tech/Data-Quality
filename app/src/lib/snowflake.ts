/**
 * Snowflake client — unified for Node and Cloudflare Workers.
 *
 * Uses the Snowflake REST API (HTTPS + session-token auth) instead of the
 * native `snowflake-sdk` so the same code runs in:
 *   • Node.js  (file-backed store)
 *   • Cloudflare Workers  (KV-backed store)
 *
 * The connection-resolution function picks the right store at runtime via
 * a tiny detection helper. The actual REST plumbing lives in snowflake-rest.ts.
 */

export {
  querySnowflake,
  getTableMetadata,
  getColumnMetadata,
  previewTable,
  getViewDefinitions,
  getMaterializedViewDefinitions,
  getConnectionSummary,
  discoverSnowflakeResources,
} from './snowflake-rest'
