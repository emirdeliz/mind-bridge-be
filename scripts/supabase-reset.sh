#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

read_env_value() {
  local key="$1"
  if [[ ! -f .env ]]; then
    return 0
  fi
  grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

SUPABASE_URL="$(read_env_value SUPABASE_URL)"

is_cloud_url() {
  [[ "${1:-}" == *"supabase.co"* ]]
}

if is_cloud_url "$SUPABASE_URL"; then
  echo "SUPABASE_URL aponta para Supabase Cloud: $SUPABASE_URL"
  echo ""
  echo "supabase db reset (sem --linked) só reseta o banco LOCAL do Docker."
  echo "Para reset destrutivo no Cloud: npm run supabase:reset:cloud -- --confirm"
  echo "Para aplicar migrations:        npm run supabase:push:cloud"
  exit 0
fi

echo "SUPABASE_URL aponta para Supabase local. Executando db reset…"
npx supabase db reset
npm run supabase:env
echo "Reset local concluído (schema recriado; sem seed de dados demo)."
