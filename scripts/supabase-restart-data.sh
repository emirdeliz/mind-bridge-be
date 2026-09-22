#!/usr/bin/env bash
# Reinicia todos os dados relacionados ao Supabase (schema + opcionalmente auth).
#
# Local (Docker):
#   npm run supabase:restart-data
#
# Cloud (destrutivo — exige confirmação):
#   npm run supabase:restart-data -- --confirm
#
# Só limpar dados via API (sem reaplicar migrations):
#   npm run supabase:restart-data -- --data-only --confirm
#
# Após reset Cloud, também apagar auth.users remanescentes:
#   npm run supabase:restart-data -- --confirm --purge-auth
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIRM=0
DATA_ONLY=0
PURGE_AUTH=0

for arg in "$@"; do
  case "$arg" in
    --confirm) CONFIRM=1 ;;
    --data-only) DATA_ONLY=1 ;;
    --purge-auth) PURGE_AUTH=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Argumento desconhecido: $arg"
      echo "Use --help para ver as opções."
      exit 1
      ;;
  esac
done

read_env_value() {
  local key="$1"
  if [[ ! -f .env ]]; then
    return 0
  fi
  grep -E "^${key}=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

is_cloud_url() {
  [[ "${1:-}" == *"supabase.co"* ]]
}

SUPABASE_URL="$(read_env_value SUPABASE_URL)"

require_cloud_confirm() {
  if [[ "$CONFIRM" -eq 1 ]]; then
    return 0
  fi
  echo "ATENÇÃO: operação destrutiva no Supabase Cloud."
  echo "  URL: ${SUPABASE_URL:-'(vazio)'}"
  echo ""
  echo "Confirme com:"
  echo "  npm run supabase:restart-data -- --confirm"
  echo ""
  echo "Opções extras:"
  echo "  --data-only   limpa dados via API (sem db reset)"
  echo "  --purge-auth  apaga auth.users após o reset"
  exit 1
}

ensure_local_supabase_running() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker não encontrado. Instale Docker Desktop e tente novamente."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker não está em execução. Inicie o daemon e tente novamente."
    exit 1
  fi

  if ! npx supabase status >/dev/null 2>&1; then
    echo "Supabase local parado. Iniciando…"
    npm run supabase:start
  else
    echo "Supabase local já está em execução."
  fi
}

run_purge_auth() {
  echo ""
  echo "Purgando auth + tabelas de plataforma via service role…"
  node --env-file=.env scripts/purge-supabase-data.mjs --yes
}

echo "=== Mind Bridge — restart dados Supabase ==="
echo "  SUPABASE_URL: ${SUPABASE_URL:-'(vazio)'}"
echo ""

# ─── Cloud ───────────────────────────────────────────────────────────────────
if is_cloud_url "$SUPABASE_URL"; then
  require_cloud_confirm

  if [[ "$DATA_ONLY" -eq 1 ]]; then
    echo "Modo Cloud --data-only: purge via API (sem reaplicar migrations)."
    run_purge_auth
    echo ""
    echo "Restart Cloud (data-only) concluído."
    exit 0
  fi

  # shellcheck source=lib/supabase-cloud.sh
  source "$ROOT/scripts/lib/supabase-cloud.sh"
  ensure_cloud_env
  ensure_project_linked "$PROJECT_REF"

  echo "Resetando banco remoto (migrations + --no-seed)…"
  npx supabase db reset --linked --yes --no-seed

  if [[ "$PURGE_AUTH" -eq 1 ]]; then
    run_purge_auth
  else
    echo ""
    echo "Nota: auth.users podem permanecer no Cloud após db reset."
    echo "      Use --purge-auth para apagá-los."
  fi

  echo ""
  echo "Restart Cloud concluído."
  exit 0
fi

# ─── Local ───────────────────────────────────────────────────────────────────
if [[ "$DATA_ONLY" -eq 1 ]]; then
  if [[ "$CONFIRM" -eq 0 ]]; then
    echo "ATENÇÃO: --data-only apaga todos os usuários e dados de app."
    echo "Confirme com: npm run supabase:restart-data -- --data-only --confirm"
    exit 1
  fi
  ensure_local_supabase_running
  npm run supabase:env
  run_purge_auth
  echo ""
  echo "Restart local (data-only) concluído."
  exit 0
fi

ensure_local_supabase_running

echo "Recriando banco local (migrations)…"
npx supabase db reset

echo ""
echo "Sincronizando SUPABASE_* no .env…"
npm run supabase:env

if [[ "$PURGE_AUTH" -eq 1 ]]; then
  run_purge_auth
fi

echo ""
echo "Restart local concluído (schema recriado; sem seed de dados demo)."
