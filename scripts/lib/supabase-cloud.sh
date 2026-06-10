#!/usr/bin/env bash

_SUPABASE_CLOUD_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

supabase_cloud_root() {
  cd "$_SUPABASE_CLOUD_LIB_DIR/../.." && pwd
}

read_env_value() {
  local key="$1"
  local root
  root="$(supabase_cloud_root)"
  if [[ ! -f "$root/.env" ]]; then
    echo ""
    return 0
  fi

  # grep returns 1 when the key is missing — must not abort scripts with set -e
  grep -E "^${key}=" "$root/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

is_cloud_url() {
  [[ "${1:-}" == *"supabase.co"* ]]
}

extract_project_ref() {
  local url="$1"
  if [[ "$url" =~ https://([a-z0-9]+)\.supabase\.co ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

linked_project_ref() {
  local root
  root="$(supabase_cloud_root)"
  local ref_file="$root/supabase/.temp/project-ref"
  if [[ -f "$ref_file" ]]; then
    tr -d '[:space:]' <"$ref_file"
    return 0
  fi
  return 1
}

ensure_cloud_env() {
  local root
  root="$(supabase_cloud_root)"
  cd "$root"

  SUPABASE_URL="$(read_env_value SUPABASE_URL)"
  SUPABASE_DB_PASSWORD="$(read_env_value SUPABASE_DB_PASSWORD)"

  if ! is_cloud_url "$SUPABASE_URL"; then
    echo "SUPABASE_URL não aponta para Supabase Cloud: ${SUPABASE_URL:-'(vazio)'}"
    exit 1
  fi

  PROJECT_REF="$(extract_project_ref "$SUPABASE_URL" || true)"
  if [[ -z "$PROJECT_REF" ]]; then
    echo "Não foi possível extrair project-ref de SUPABASE_URL: $SUPABASE_URL"
    exit 1
  fi

  export SUPABASE_URL SUPABASE_DB_PASSWORD PROJECT_REF
}

ensure_project_linked() {
  local project_ref="$1"

  local current_ref=""
  if current_ref="$(linked_project_ref)"; then
    if [[ "$current_ref" == "$project_ref" ]]; then
      echo "Projeto já linkado: $project_ref"
      return 0
    fi
    echo "Projeto linkado ($current_ref) difere do SUPABASE_URL ($project_ref)."
    echo "Execute: npx supabase link --project-ref $project_ref"
    exit 1
  fi

  echo "Projeto não linkado. Executando supabase link…"
  if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    echo ""
    echo "Defina SUPABASE_DB_PASSWORD no .env (senha do banco em Supabase → Project Settings → Database)"
    echo "Também é necessário: npx supabase login"
    echo "Depois: npx supabase link --project-ref $project_ref"
    exit 1
  fi

  npx supabase link --project-ref "$project_ref" -p "$SUPABASE_DB_PASSWORD" --yes
}
