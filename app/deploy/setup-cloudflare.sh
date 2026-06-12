#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# DataGuard — one-shot Cloudflare bootstrap script.
#
# Compatible with macOS's stock bash 3.2 (no associative arrays).
#
# Steps:
#   1. Ensure wrangler + @opennextjs/cloudflare are installed
#   2. Authenticate with Cloudflare
#   3. Create the five KV namespaces (production + preview)
#   4. Patch the returned ids into wrangler.toml
#   5. Seed connections.json → CONNECTIONS_KV
#   6. Prompt for each secret
#
# Usage:
#   ./deploy/setup-cloudflare.sh
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail   # -e is OFF — we want to surface partial errors with context

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { printf "${GREEN}▸${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; exit 1; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }

# ─── prereqs ────────────────────────────────────────────────────────────
command -v node       >/dev/null || err "node not installed"
command -v npx        >/dev/null || err "npx not installed"
command -v python3    >/dev/null || err "python3 not installed (used for JSON parsing)"
[[ -f wrangler.toml ]] || err "wrangler.toml missing — are you in the project root?"

# ─── 1 · Dependency install ─────────────────────────────────────────────
log "Step 1/6: ensuring Cloudflare deps are installed…"
if [[ -d node_modules/@opennextjs/cloudflare && -d node_modules/wrangler ]]; then
  ok "wrangler + @opennextjs/cloudflare already present — skipping install"
else
  log "  running: npm install"
  if ! npm install; then
    err "npm install failed. Run 'npm install' manually to see the full error.
        Common fix: rm -rf node_modules package-lock.json && npm install"
  fi
  ok "deps installed"
fi

WRANGLER_VERSION=$(npx --no-install wrangler --version 2>/dev/null | head -1)
[[ -z "$WRANGLER_VERSION" ]] && err "wrangler not callable via npx — check node_modules"
ok "wrangler ready: $WRANGLER_VERSION"

# ─── 2 · Cloudflare login ───────────────────────────────────────────────
log "Step 2/6: authenticating with Cloudflare…"
if npx wrangler whoami 2>/dev/null | grep -q -i 'logged in\|associated with the email'; then
  ok "already logged in"
else
  log "  opening browser to authorize…"
  npx wrangler login || err "Cloudflare login failed"
fi

# ─── 3 · Create KV namespaces ───────────────────────────────────────────
log "Step 3/6: creating KV namespaces (idempotent — re-uses existing if present)…"

# Use parallel indexed arrays — bash 3.2 compatible.
NS_NAMES=(CONNECTIONS_KV RULES_KV REPORTS_KV ALERTS_KV SESSION_KV)
NS_IDS=()
NS_PREVIEW_IDS=()

for ns in "${NS_NAMES[@]}"; do
  log "  $ns …"

  # Production namespace
  OUT=$(npx wrangler kv namespace create "$ns" 2>&1 || true)
  # Wrangler prints either: id = "abc123..."  OR an error if it already exists.
  PROD_ID=$(echo "$OUT" | grep -oE 'id = "[a-f0-9]{32}"' | head -1 | sed 's/id = "//;s/"//')

  if [[ -z "$PROD_ID" ]]; then
    # Try to find it via wrangler kv namespace list
    LIST_JSON=$(npx wrangler kv namespace list 2>/dev/null || echo '[]')
    PROD_ID=$(echo "$LIST_JSON" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  for x in data:
    title = x.get('title','')
    if title == '$ns' or title.endswith('-$ns'):
      print(x['id']); break
except: pass
" 2>/dev/null)
  fi

  if [[ -n "$PROD_ID" ]]; then
    ok "    prod id: $PROD_ID"
  else
    warn "    couldn't determine prod id; output was:"
    echo "$OUT" | head -3 | sed 's/^/        /'
    PROD_ID=""
  fi
  NS_IDS+=("$PROD_ID")

  # Preview namespace
  OUT=$(npx wrangler kv namespace create "$ns" --preview 2>&1 || true)
  PREVIEW_ID=$(echo "$OUT" | grep -oE 'id = "[a-f0-9]{32}"' | head -1 | sed 's/id = "//;s/"//')

  if [[ -z "$PREVIEW_ID" ]]; then
    LIST_JSON=$(npx wrangler kv namespace list 2>/dev/null || echo '[]')
    PREVIEW_ID=$(echo "$LIST_JSON" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  for x in data:
    title = x.get('title','')
    if title == '${ns}_preview' or title.endswith('-${ns}_preview'):
      print(x['id']); break
except: pass
" 2>/dev/null)
  fi

  if [[ -n "$PREVIEW_ID" ]]; then
    ok "    preview id: $PREVIEW_ID"
  else
    warn "    couldn't determine preview id"
    PREVIEW_ID=""
  fi
  NS_PREVIEW_IDS+=("$PREVIEW_ID")
done

# ─── 4 · Patch wrangler.toml ────────────────────────────────────────────
log "Step 4/6: writing KV ids into wrangler.toml…"
[[ -f wrangler.toml.bak ]] || cp wrangler.toml wrangler.toml.bak

# Build a Python dict of { name: (prod_id, preview_id) } and run a single
# patch pass that re-writes each [[kv_namespaces]] block by binding name.
PATCH_INPUT=""
for i in "${!NS_NAMES[@]}"; do
  PATCH_INPUT="${PATCH_INPUT}${NS_NAMES[$i]}|${NS_IDS[$i]}|${NS_PREVIEW_IDS[$i]}"$'\n'
done

echo "$PATCH_INPUT" | python3 <<'PY'
import re, sys
src = open('wrangler.toml').read()
patched = 0
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    parts = line.split('|', 2)
    if len(parts) != 3: continue
    name, pid, ppr = parts
    if not pid: continue   # nothing to patch

    # Re-write the matching [[kv_namespaces]] block (binding = "<name>")
    pat = (
        r'(\[\[kv_namespaces\]\]\s*\nbinding\s*=\s*"' + re.escape(name) + r'"\s*\n)'
        r'id\s*=\s*"[^"]*"(\s*\n)'
        r'preview_id\s*=\s*"[^"]*"'
    )
    repl = r'\1id      = "' + pid + r'"\2preview_id = "' + (ppr or pid) + r'"'
    new, n = re.subn(pat, repl, src)
    if n > 0:
        src = new
        patched += n

open('wrangler.toml', 'w').write(src)
print(f"  patched {patched} block(s) in wrangler.toml")
PY

# ─── 5 · Seed connections from local JSON ───────────────────────────────
if [[ -f data/connections.json ]]; then
  log "Step 5/6: seeding CONNECTIONS_KV from local data/connections.json…"
  python3 <<'PY'
import json, subprocess, sys
try:
    data = json.load(open('data/connections.json'))
except Exception as e:
    print(f"  skipping seed: {e}"); sys.exit(0)
ids = [c['id'] for c in data]

# Write index — pass --preview false explicitly because wrangler complains
# when both id + preview_id are configured (otherwise it can't tell which).
common = ['npx','wrangler','kv','key','put','--binding','CONNECTIONS_KV','--remote','--preview','false']

r = subprocess.run(common + ['_index', json.dumps(ids)], capture_output=True, text=True)
if r.returncode != 0:
    print(f"  warn: index write returned {r.returncode}: {r.stderr[:200]}")

for c in data:
    r = subprocess.run(common + [f'row:{c["id"]}', json.dumps(c)], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  warn: row write for {c['id']} returned {r.returncode}: {r.stderr[:200]}")

print(f"  seeded {len(data)} connection(s)")
PY
else
  log "Step 5/6: no local data/connections.json — skipping seed"
fi

# ─── 6 · Secrets ────────────────────────────────────────────────────────
log "Step 6/6: configuring secrets (you'll be prompted for each)…"
# Parallel arrays for name + description.
SEC_NAMES=(ANTHROPIC_API_KEY SLACK_WEBHOOK TEAMS_WEBHOOK WEBEX_WEBHOOK PAGERDUTY_ROUTING_KEY SENDGRID_API_KEY)
SEC_DESCS=(
  "AI Agent (Claude) — required for chat features"
  "Slack incoming-webhook URL (or skip)"
  "Microsoft Teams webhook URL (or skip)"
  "Webex bot webhook URL (or skip)"
  "PagerDuty Events API v2 routing key (or skip)"
  "SendGrid API key for email alerts (or skip)"
)

for i in "${!SEC_NAMES[@]}"; do
  name="${SEC_NAMES[$i]}"
  desc="${SEC_DESCS[$i]}"
  echo
  printf "${YELLOW}Set %s ?${NC} (%s) [y/N] " "$name" "$desc"
  read -r yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    # `--env production` to match wrangler.toml [env.production] block
    if ! npx wrangler secret put "$name" --env production; then
      warn "  failed to set $name — likely because the Worker hasn't been deployed yet."
      warn "  After 'npm run deploy:prod' creates the Worker, re-run:"
      warn "     npx wrangler secret put $name --env production"
    fi
  else
    warn "  skipped — set later with: npx wrangler secret put $name --env production"
  fi
done

# ─── Done ───────────────────────────────────────────────────────────────
echo
log "All bootstrap steps complete. Next:"
echo
echo "    npm run build:cf      # Build Next.js → OpenNext bundle"
echo "    npm run deploy:prod   # Deploy to Cloudflare Workers (production)"
echo "    npm run cf:tail       # Stream live logs"
echo
echo "Your app will be live at: https://dataguard.<your-account>.workers.dev"
