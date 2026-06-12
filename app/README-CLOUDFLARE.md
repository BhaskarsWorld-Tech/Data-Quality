# DataGuard on Cloudflare — Quick Start

Deploy DataGuard to **Cloudflare Workers + KV** in 3 commands.

## TL;DR

```bash
npm install
./deploy/setup-cloudflare.sh    # one-time bootstrap
npm run deploy:prod              # subsequent deploys
```

Your app goes live at `https://dataguard.<your-account>.workers.dev` in about 90 seconds.

## What gets deployed

| Layer | Cloudflare service | File |
|---|---|---|
| Next.js SSR + API | Workers (OpenNext adapter) | `open-next.config.ts`, `wrangler.toml` |
| Connections / Rules / Reports / Alerts config | **5 × KV namespaces** | `src/lib/kv-store.ts` |
| Snowflake REST client (used by Node + Workers) | fetch + WebCrypto | `src/lib/snowflake-rest.ts` |
| Static assets | Workers Assets binding | auto via OpenNext |
| Secrets (API keys, webhooks) | Workers secrets (encrypted) | `wrangler secret put` |
| Scheduled checks | Cron trigger (hourly) | `wrangler.toml [triggers]` |
| CI/CD | GitHub Actions | `.github/workflows/deploy-cloudflare.yml` |

## Files added for Cloudflare

```
app/
├── wrangler.toml                          ← Workers + KV config
├── open-next.config.ts                    ← OpenNext adapter config
├── .dev.vars.example                      ← Local secrets template
├── src/lib/
│   ├── snowflake.ts                       ← Thin shim re-exporting from snowflake-rest
│   ├── snowflake-rest.ts                  ← Unified REST client (works on Node + Workers)
│   └── kv-store.ts                        ← KV-backed persistence (selected at runtime)
├── deploy/
│   ├── setup-cloudflare.sh                ← One-shot bootstrap
│   └── DEPLOY.md                          ← Full step-by-step guide
└── .github/workflows/
    └── deploy-cloudflare.yml              ← CI/CD (PR previews + prod)
```

Existing files (Node deployment) are **untouched and continue to work**. The `snowflake.ts` router detects the runtime and picks the right backend automatically.

## Next steps

1. Read **`deploy/DEPLOY.md`** — full step-by-step guide with troubleshooting.
2. Run `./deploy/setup-cloudflare.sh` — interactive bootstrap that creates KV namespaces, seeds your existing connections, prompts for secrets, and deploys.
3. Add `CF_API_TOKEN` + `CF_ACCOUNT_ID` to GitHub secrets → every push to `main` auto-deploys.

## Local development against Workers

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars to add your real secrets
npm run preview:cf                # runs wrangler dev with real KV emulator
```

## Cost

Free tier covers 100k requests/day. Typical demo deployments run $0/mo for the first few months. See `deploy/DEPLOY.md` for full pricing detail.
