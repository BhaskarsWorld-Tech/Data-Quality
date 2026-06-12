/**
 * OpenNext build configuration — compiles Next.js for Cloudflare Workers.
 * See: https://opennext.js.org/cloudflare
 *
 * We deliberately skip the KV-backed incremental cache to keep the binding
 * surface small. Pages re-render on every request anyway (force-dynamic).
 * If you want SSG caching, add `NEXT_INC_CACHE_KV` to wrangler.toml and
 * re-enable `incrementalCache: kvIncrementalCache` here.
 */
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig({
  queue: 'direct',
  routePreloadingBehavior: 'none',
})
