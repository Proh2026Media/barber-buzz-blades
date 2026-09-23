#!/usr/bin/env bash
# Gera / atualiza Traefik dynamic config para domínios próprios ativos.
# Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# Opcional: TRAEFIK_DYNAMIC_DIR (default no VPS: /data/coolify/proxy/dynamic)
#           HOSTINGER_BEAUTY_URL (default: http://beauty.contheiner.digital)

set -euo pipefail
URL="${SUPABASE_URL:?}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:?}"
OUT_DIR="${TRAEFIK_DYNAMIC_DIR:-/data/coolify/proxy/dynamic}"
BACKEND="${HOSTINGER_BEAUTY_URL:-http://beauty.contheiner.digital}"
OUT_FILE="${OUT_DIR}/custom-shop-domains.yaml"

payload=$(curl -sS "${URL%/}/rest/v1/rpc/list_active_custom_domains" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

python3 - "$OUT_FILE" "$BACKEND" <<'PY' <<<"$payload"
import json, sys
out_file, backend = sys.argv[1], sys.argv[2]
raw = sys.stdin.read().strip() or "[]"
try:
    rows = json.loads(raw)
except json.JSONDecodeError:
    rows = []
if not isinstance(rows, list):
    rows = []

active = [r for r in rows if r.get("status") == "active" and r.get("custom_domain")]
rules = []
for i, row in enumerate(active):
    host = row["custom_domain"].replace('"', "")
    name = f"shop-custom-{i}"
    rules.append(
        f"""    {name}-http:
      rule: Host(`{host}`)
      entryPoints: [http]
      middlewares: [redirect-to-https]
      service: hostinger-beauty-custom
      priority: 20
    {name}-https:
      rule: Host(`{host}`)
      entryPoints: [https]
      service: hostinger-beauty-custom
      tls:
        certResolver: letsencrypt
      priority: 20"""
    )

body = "http:\n  routers:\n"
if rules:
    body += "\n".join(rules) + "\n"
else:
    body += "    shop-custom-placeholder:\n      rule: Host(`__none__.invalid`)\n      entryPoints: [http]\n      service: hostinger-beauty-custom\n      priority: 1\n"

body += f"""  services:
    hostinger-beauty-custom:
      loadBalancer:
        passHostHeader: false
        servers:
          - url: "{backend}"
"""

with open(out_file, "w", encoding="utf-8") as f:
    f.write(body)
print(f"Wrote {out_file} ({len(active)} active custom domains)")
PY
