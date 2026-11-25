#!/usr/bin/env bash
# Derruba a Catraca. Por padrão mantém o volume de dados do Postgres.
# Use --tudo para apagar também os dados (down -v).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

if [ "${1:-}" = "--tudo" ]; then
  echo "[down] derrubando e APAGANDO o volume de dados..."
  docker compose down -v
else
  echo "[down] derrubando (dados preservados)..."
  docker compose down
fi

echo "[down] pronto."
