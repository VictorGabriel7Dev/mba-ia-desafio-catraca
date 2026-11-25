#!/usr/bin/env bash
# Roda TODOS os gates de qualidade e sai != 0 se qualquer um falhar,
# sem parar no primeiro erro (acumula e reporta no fim).
# Gates: api (lint, typecheck, test) e web (lint, typecheck, build).
# Os testes da API precisam do Postgres: este script garante o "db" no ar
# e migra um banco de teste separado (catraca_test) antes do vitest.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

# Lê o .env (ou o exemplo) para as credenciais do Postgres.
if [ -f .env ]; then
  set -a; . ./.env; set +a
else
  set -a; . ./.env.example; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-catraca}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-catraca}"
DB_HOST_PORT="${DB_HOST_PORT:-5432}"
DB_TESTE="${DB_TESTE:-catraca_test}"
URL_TESTE="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${DB_HOST_PORT}/${DB_TESTE}?schema=public"

echo "[gates] garantindo o Postgres no ar..."
docker compose up -d db
CID="$(docker compose ps -q db)"
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$CID" 2>/dev/null)" = "healthy" ]; do
  sleep 2
done

echo "[gates] garantindo o banco de teste ${DB_TESTE}..."
if ! docker compose exec -T db psql -U "$POSTGRES_USER" -tAc \
     "SELECT 1 FROM pg_database WHERE datname='${DB_TESTE}'" | grep -q 1; then
  docker compose exec -T db createdb -U "$POSTGRES_USER" "$DB_TESTE"
fi

# Preparação (não é gate; aborta se falhar, pois sem isso nada roda).
prep() {
  echo "[gates] preparando dependências da API..."
  ( cd "$RAIZ/api" && { [ -d node_modules ] || npm ci; } && npx prisma generate ) || return 1
  echo "[gates] preparando dependências do front..."
  ( cd "$RAIZ/web" && { [ -d node_modules ] || npm ci; } ) || return 1
}
if ! prep; then
  echo "[gates] FALHA na preparação de dependências. Abortando." >&2
  exit 2
fi

declare -a PASSOU=()
declare -a FALHOU=()

gate() {
  local nome="$1"; shift
  echo
  echo ">>> GATE: ${nome}"
  if "$@"; then
    echo "<<< PASSOU: ${nome}"
    PASSOU+=("$nome")
  else
    echo "<<< FALHOU: ${nome}"
    FALHOU+=("$nome")
  fi
}

api_lint()      { ( cd "$RAIZ/api" && npm run -s lint ); }
api_typecheck() { ( cd "$RAIZ/api" && npm run -s typecheck ); }
api_test()      { ( cd "$RAIZ/api" && DATABASE_URL="$URL_TESTE" npm run -s test ); }
web_lint()      { ( cd "$RAIZ/web" && npm run -s lint ); }
web_typecheck() { ( cd "$RAIZ/web" && npm run -s typecheck ); }
web_build()     { ( cd "$RAIZ/web" && npm run -s build ); }

gate "api lint"       api_lint
gate "api typecheck"  api_typecheck
gate "api test"       api_test
gate "web lint"       web_lint
gate "web typecheck"  web_typecheck
gate "web build"      web_build

echo
echo "========================= RESUMO DOS GATES ========================="
for g in "${PASSOU[@]:-}"; do [ -n "$g" ] && echo "  PASSOU: $g"; done
for g in "${FALHOU[@]:-}"; do [ -n "$g" ] && echo "  FALHOU: $g"; done
echo "===================================================================="

if [ "${#FALHOU[@]}" -gt 0 ]; then
  echo "[gates] ${#FALHOU[@]} gate(s) falharam."
  exit 1
fi
echo "[gates] todos os gates passaram."
