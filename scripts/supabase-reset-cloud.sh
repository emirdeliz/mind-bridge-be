#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/supabase-cloud.sh
source "$SCRIPT_DIR/lib/supabase-cloud.sh"

require_confirmation() {
  if [[ "${CONFIRM_CLOUD_RESET:-}" == "yes" ]]; then
    return 0
  fi

  for arg in "$@"; do
    if [[ "$arg" == "--confirm" ]]; then
      return 0
    fi
  done

  echo "ATENÇÃO: reset destrutivo no Supabase Cloud."
  echo "Apaga dados das tabelas públicas e reaplica migrations."
  echo "Usuários em auth.users NÃO são removidos (o seed reutiliza contas existentes)."
  echo ""
  echo "Confirme com:"
  echo "  npm run supabase:reset:cloud -- --confirm"
  echo "ou:"
  echo "  CONFIRM_CLOUD_RESET=yes npm run supabase:reset:cloud"
  exit 1
}

ensure_cloud_env
require_confirmation "$@"

echo "Supabase Cloud reset"
echo "  URL:          $SUPABASE_URL"
echo "  Project ref:  $PROJECT_REF"
echo ""

ensure_project_linked "$PROJECT_REF"

echo "Resetando banco remoto (migrations + --no-seed)…"
npx supabase db reset --linked --yes --no-seed

echo ""
echo "Executando seed idempotente…"
npm run seed:local

echo ""
echo "Reset Cloud concluído."
