#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/supabase-cloud.sh
source "$SCRIPT_DIR/lib/supabase-cloud.sh"

ensure_cloud_env

echo "Aplicando migrations no Supabase Cloud…"
echo "  URL:         $SUPABASE_URL"
echo "  Project ref: $PROJECT_REF"
echo ""

ensure_project_linked "$PROJECT_REF"

if ! npx supabase db push --linked --yes; then
  echo ""
  echo "Falha ao aplicar migrations. Verifique:"
  echo "  1. npx supabase login"
  echo "  2. SUPABASE_DB_PASSWORD no .env (Project Settings → Database)"
  echo "  3. npx supabase link --project-ref $PROJECT_REF"
  exit 1
fi

echo ""
echo "Migrations aplicadas."
