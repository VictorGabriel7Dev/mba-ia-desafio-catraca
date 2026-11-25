# Catraca

Desafio 311 (MBA Eng. de Software com IA, FullCycle): do brief ao produto em modo agente. Venda de ingressos para eventos pequenos (shows em bar, workshops, meetups).

## Stack
Node.js + TypeScript + Express, PostgreSQL via Prisma, front em React + Vite. Gateway de pagamento simulado. Tudo em docker-compose, sobe com um comando.

## Começar
```bash
cp .env.example .env     # opcional: up.sh faz isso sozinho na primeira vez
bash scripts/up.sh       # sobe tudo, aplica migrações e seed, imprime endereços e contas
bash scripts/gates.sh    # roda todos os gates de qualidade (lint, typecheck, testes, build)
bash scripts/down.sh     # derruba (use --tudo para apagar os dados)
```
Endereços: API http://localhost:4000, Web http://localhost:5173, Postgres localhost:5432.

Os detalhes de contas da seed, chave de parceiro e regras de camada estão em [AGENTS.md](AGENTS.md).

## Documentação
- `docs/PRD.md` - visão, features, grafo de dependências, waves e critérios de aceite.
- `docs/specs/` - spec, plano e contrato de cada feature (F1 a F6) e as convenções compartilhadas.
- `docs/avaliacoes/` - relatórios de avaliação independente por feature.
- `docs/estado.json` - estado de cada feature.

## Estado
Harness pronto e F1 (contas e sessão) implementada e testada. O esquema Prisma completo (User, PartnerKey, Event, Ticket, Payment) já entra na F1; as features seguintes adicionam comportamento.
