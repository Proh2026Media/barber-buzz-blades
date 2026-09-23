#!/usr/bin/env bash
# Lista domínios customizados ativos/pendentes (para sync manual no Traefik/Hostinger).
# Uso (com service role): SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/sync-shop-domains.sh

set -euo pipefail
URL="${SUPABASE_URL:?}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:?}"

curl -sS "${URL%/}/rest/v1/rpc/list_active_custom_domains" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
