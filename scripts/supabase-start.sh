#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale Docker Desktop (ou engine + compose) e tente novamente."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker não está em execução. Inicie o daemon e tente novamente."
  exit 1
fi

echo "Iniciando stack Supabase local (containers Docker)..."
npx supabase start

echo ""
echo "URLs locais:"
npx supabase status

echo ""
echo "Para preencher SUPABASE_* no .env: npm run supabase:env"
