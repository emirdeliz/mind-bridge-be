#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! npx supabase status >/dev/null 2>&1; then
  echo "Supabase local não está rodando. Execute: npm run supabase:start"
  exit 1
fi

ENV_FILE="${1:-$ROOT/.env}"
TMP="$(mktemp)"

npx supabase status -o env >"$TMP"

API_URL="$(grep -E '^API_URL=' "$TMP" | cut -d= -f2- | tr -d '"')"
ANON_KEY="$(grep -E '^ANON_KEY=' "$TMP" | cut -d= -f2- | tr -d '"')"
SERVICE_KEY="$(grep -E '^SERVICE_ROLE_KEY=' "$TMP" | cut -d= -f2- | tr -d '"')"

rm -f "$TMP"

if [[ -z "$API_URL" || -z "$ANON_KEY" || -z "$SERVICE_KEY" ]]; then
  echo "Não foi possível ler API_URL / ANON_KEY / SERVICE_ROLE_KEY de 'supabase status'."
  exit 1
fi

upsert() {
  local key="$1"
  local value="$2"
  if [[ -f "$ENV_FILE" ]] && grep -q "^${key}=" "$ENV_FILE"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

touch "$ENV_FILE"
upsert "SUPABASE_URL" "$API_URL"
upsert "SUPABASE_ANON_KEY" "$ANON_KEY"
upsert "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_KEY"

echo "Atualizado em $ENV_FILE:"
echo "  SUPABASE_URL=$API_URL"
echo "  SUPABASE_ANON_KEY=(definido)"
echo "  SUPABASE_SERVICE_ROLE_KEY=(definido)"
