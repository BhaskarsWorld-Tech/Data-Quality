# Deploying DataGuard on Cloudflare

Complete step-by-step guide for deploying the DataGuard data-quality platform to **Cloudflare Workers + KV** using the OpenNext adapter for Next.js.

## What you'll get

| Component | Cloudflare service |
|---|---|
| **Next.js app (SSR + API routes)** | Workers (via OpenNext adapter) |
| **Static assets (JS, CSS, images)** | Workers static-asset bindings |
| **JSON file storage** (`connections.json`, `rules.json`, `reports.json`, `alerts-config.json`) | **5 × KV namespaces** |
| **Snowflake session cache** | KV (`SESSION_KV`) — 3.5 h TTL |
| **API keys / webhook secrets** | Workers secrets (encrypted at rest) |
| **Scheduled quality checks** | Cron trigger (hourly) |
| **Observability** | Workers Logs + Tail |

Approximate monthly cost on the free tier: **$0** for development traffic, **$5/mo** + per-request once you exceed 100k req/day.

---

## Prerequisites

1. **Cloudflare account** — free tier is enough to start: <https://dash.cloudflare.com/sign-up>
2. **Node 20+** (Workers runtime targets Node 22 compat).
3. **Wrangler CLI** — installed automatically by the bootstrap script, but you can pre-install: `npm i -g wrangler`.
4. **Your Snowflake credentials** already in `data/connections.json` (used to seed `CONNECTIONS_KV`).

---

## One-shot setup (recommended)

```bash
cd /path/to/Data-Quality/app
./deploy/setup-cloudflare.sh
```

The script will:

1. Run `wrangler login` (opens a browser to authorize).
2. Create the five KV namespaces (`CONNECTIONS_KV`, `RULES_KV`, `REPORTS_KV`, `ALERTS_KV`, `SESSION_KV`) for both production and preview environments.
3. Patch the namespace IDs into `wrangler.toml`.
4. Seed `CONNECTIONS_KV` from your local `data/connections.json`.
5. Prompt you for each secret (`ANTHROPIC_API_KEY`, `SLACK_WEBHOOK`, etc.).
6. Build with OpenNext and deploy.

When it's done, your app is live at `https://dataguard.<your-account>.workers.dev`.

---

## Manual setup (if you prefer step-by-step)

### 1 · Install Cloudflare dependencies

```bash
npm install --save-dev wrangler @opennextjs/cloudflare
```

### 2 · Authenticate

```bash
npx wrangler login
```

### 3 · Create KV namespaces

```bash
for ns in CONNECTIONS_KV RULES_KV REPORTS_KV ALERTS_KV SESSION_KV; do
  npx wrangler kv:namespace create "$ns"
  npx wrangler kv:namespace create "$ns" --preview
done
```

Copy each returned `id` and `preview_id` into the corresponding `[[kv_namespaces]]` block in `wrangler.toml`. Example output for one namespace:

```toml
[[kv_namespaces]]
binding    = "CONNECTIONS_KV"
id         = "abc123…"          # ← paste production id
preview_id = "def456…"          # ← paste preview id
```

### 4 · Seed connection data

```bash
# Read existing connections.json and push each row to KV
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('data/connections.json'));
  const { execSync } = require('child_process');
  execSync(\`npx wrangler kv:key put --binding CONNECTIONS_KV _index '\${JSON.stringify(data.map(c => c.id))}'\`);
  for (const c of data) {
    execSync(\`npx wrangler kv:key put --binding CONNECTIONS_KV 'row:\${c.id}' '\${JSON.stringify(c)}'\`);
  }
  console.log(\`✓ Seeded \${data.length} connection(s)\`);
"
```

Repeat for `rules.json` → `RULES_KV` and `reports.json` → `REPORTS_KV` if you have local data.

### 5 · Set secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY      # paste your Claude API key
npx wrangler secret put SLACK_WEBHOOK          # https://hooks.slack.com/…
npx wrangler secret put TEAMS_WEBHOOK          # https://yourorg.webhook.office.com/…
npx wrangler secret put WEBEX_WEBHOOK          # https://webexapis.com/v1/webhooks/…
npx wrangler secret put PAGERDUTY_ROUTING_KEY  # 32-char integration key
npx wrangler secret put SENDGRID_API_KEY       # SG.xxx (for email)
```

These are stored encrypted; they appear in your Worker as `process.env.SLACK_WEBHOOK` etc.

### 6 · Build for Workers

```bash
npm run build:cf
```

This runs `next build` then `@opennextjs/cloudflare build`, producing `.open-next/worker.js` + `.open-next/assets/`.

### 7 · Deploy

```bash
# Preview environment
npm run deploy

# Production
npm run deploy:prod
```

Visit the URL Wrangler prints — typically `https://dataguard.<your-account>.workers.dev`.

---

## Custom domain

```bash
# 1. Add your domain to Cloudflare (Dashboard → Add Site)
# 2. Add the route to wrangler.toml:
[env.production]
name  = "dataguard"
route = "dataguard.your-domain.com/*"
# 3. Redeploy:
npm run deploy:prod
```

---

## Continuous deployment (GitHub Actions)

A workflow is included at `.github/workflows/deploy-cloudflare.yml`. Configure these GitHub repo secrets:

| Secret | Value |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token with `Workers Scripts: Edit` + `Workers KV Storage: Edit` |
| `CF_ACCOUNT_ID` | Your Cloudflare account id (visible in dashboard URL) |

Then every push to `main` deploys to production; every PR deploys to a preview URL.

Create the API token at <https://dash.cloudflare.com/profile/api-tokens> using the "Edit Cloudflare Workers" template.

---

## Local development against Cloudflare bindings

```bash
# Run Workers locally with real KV (writes to a local emulator)
npx wrangler dev

# Run pure Next.js locally (uses data/*.json fallback)
npm run dev
```

Place `.dev.vars` in the project root to provide secrets to `wrangler dev`:

```ini
# .dev.vars  (gitignored)
ANTHROPIC_API_KEY=sk-ant-…
SLACK_WEBHOOK=https://hooks.slack.com/…
TEAMS_WEBHOOK=https://yourorg.webhook.office.com/…
```

---

## Verifying the deployment

```bash
# 1. Check the worker is responding
curl https://dataguard.<your-account>.workers.dev/api/snowflake/tables \
  | jq '.tables | length'

# 2. Tail live logs
npx wrangler tail

# 3. Check KV contents
npx wrangler kv:key list --binding CONNECTIONS_KV
npx wrangler kv:key get --binding CONNECTIONS_KV _index
```

---

## Rollback

```bash
# List recent deployments
npx wrangler deployments list

# Roll back to the previous one
npx wrangler rollback
```

KV data is preserved across rollbacks — you only revert the worker code.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `snowflake-sdk` errors during build | The Cloudflare build uses `snowflake-rest.ts` automatically via the runtime check. If you see this locally during `npm run build:cf`, ensure `next.config.ts` includes `snowflake-sdk` in `serverExternalPackages`. |
| `KV binding not configured` at runtime | You forgot to paste the `id` into `wrangler.toml`. Run `npx wrangler kv:namespace list` and patch the file. |
| `401 Snowflake login failed` | Username/password in `CONNECTIONS_KV` is stale. Update with `npx wrangler kv:key put --binding CONNECTIONS_KV 'row:<id>' '<new-json>'`. |
| `SESSION_KV not configured — falling back to per-request auth` | Cosmetic warning — works but slower. Bind `SESSION_KV` to fix. |
| Worker exceeds 50 ms CPU on first cold-start hitting Snowflake | Snowflake login is slow. The session cache amortizes this — after the first request, subsequent ones use the cached token. |
| Static assets 404 | Ensure `npm run build:cf` completed; `.open-next/assets/` should contain `_next/static/…`. |
| Cron not firing | Crons only run on the deployed worker, not `wrangler dev`. Check with `npx wrangler tail` after the top of the hour. |

---

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare edge                          │
│                                                                 │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │              Workers (dataguard.workers.dev)              │ │
│   │                                                           │ │
│   │  Next.js (OpenNext)                                       │ │
│   │   ├─ SSR pages  (/, /lineage, /catalog, …)                │ │
│   │   ├─ API routes (/api/snowflake/*, /api/alerts/*)         │ │
│   │   ├─ ❄️ snowflake-rest.ts  ── HTTPS → Snowflake REST API  │ │
│   │   └─ 🤖 anthropic-sdk      ── HTTPS → api.anthropic.com   │ │
│   └────┬──────────────────────────────────────────────┬───────┘ │
│        │                                              │         │
│   ┌────▼─────┐  ┌─────────┐  ┌─────────┐  ┌─────────┬─▼──────┐  │
│   │CONN_KV   │  │RULES_KV │  │REPORTS_ │  │ALERTS_  │SESSION │  │
│   │          │  │         │  │KV       │  │KV       │_KV     │  │
│   └──────────┘  └─────────┘  └─────────┘  └─────────┴────────┘  │
│                                                                 │
│   Secrets (encrypted): ANTHROPIC_API_KEY, SLACK_WEBHOOK,        │
│                        TEAMS_WEBHOOK, WEBEX_WEBHOOK,            │
│                        PAGERDUTY_ROUTING_KEY, SENDGRID_API_KEY  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Snowflake REST API  │
                   │  (your account)      │
                   └──────────────────────┘
```

---

## Cost ballpark

For a small team (one warehouse, a few hundred quality-checks/day):

| Item | Free tier | Paid tier |
|---|---|---|
| Workers requests | 100k/day | $0.30 per 1M |
| Workers CPU time | 10ms/request | included to 30M req then $0.02/M GB-sec |
| KV reads | 100k/day | $0.50 per 1M |
| KV writes | 1k/day | $5.00 per 1M |
| KV storage | 1 GB | $0.50/GB/mo |

A typical demo deployment running 24/7 with auto-refresh every 30 s sits comfortably in the free tier.

---

## Next steps after deployment

1. Add the live URL to your alert webhook payloads so links work in Slack/Teams/Webex.
2. Configure DNS for a custom domain (`dataguard.your-domain.com`).
3. Enable Cloudflare Access (zero-trust SSO) for the worker URL if you want SSO before login.
4. Optionally migrate from KV to **Cloudflare D1** (SQLite) if you outgrow KV's eventual-consistency semantics.
