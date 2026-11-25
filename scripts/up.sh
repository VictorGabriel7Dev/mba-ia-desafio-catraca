#!/usr/bin/env bash
# Sobe toda a Catraca a partir de um clone limpo, em um passo:
# build, banco saudável, migrações aplicadas e seed idempotente.
# Rodar de novo sem derrubar NÃO quebra nem duplica a seed.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

# Garante um .env (copia do exemplo na primeira vez).
if [ ! -f .env ]; then
  echo "[up] .env ausente; copiando de .env.example"
  cp .env.example .env
fi

# Carrega o .env para uso no próprio script (o compose também o lê sozinho).
set -a; . ./.env; set +a

echo "[up] construindo imagens..."
docker compose build

echo "[up] subindo o banco..."
docker compose up -d db

echo "[up] aguardando o Postgres ficar saudável..."
CID="$(docker compose ps -q db)"
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$CID" 2>/dev/null)" = "healthy" ]; do
  sleep 2
done
echo "[up] banco saudável."

echo "[up] aplicando migrações e seed (idempotente)..."
docker compose run --rm --no-deps api sh -lc "npx prisma migrate deploy && npm run -s prisma:seed"

echo "[up] subindo api, worker e web..."
docker compose up -d api worker web

cat <<FIM

========================================================
 Catraca no ar.
--------------------------------------------------------
 API .......... http://localhost:4000   (saude: /health)
 Web .......... http://localhost:5173
 Postgres ..... localhost:${DB_HOST_PORT:-5432}

 Contas da seed (senhas conhecidas):
   organizador  ana.organizadora@catraca.dev    / organizador123
   organizador  bruno.organizador@catraca.dev   / organizador123
   participante carla.participante@catraca.dev  / participante123

 Chave de parceiro (header X-Api-Key):
   parceiro-demo-key-123

 Exemplos:
   curl http://localhost:4000/health
   curl -H 'X-Api-Key: parceiro-demo-key-123' http://localhost:4000/api/partner/events
========================================================
FIM
