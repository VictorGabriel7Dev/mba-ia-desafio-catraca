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
- `docs/specs/` - spec, plano e contrato de cada feature (F1 a F6) e as convenções compartilhadas (`_CONVENCOES.md`).
- `docs/avaliacoes/` - relatórios de avaliação independente por feature.
- `docs/estado.json` - estado de cada feature (bate com a realidade).
- `docs/FLUXO-DO-AVALIADOR.md` - como rodar e conferir tudo do zero.

## Processo (desenvolvimento em modo agente)
O produto saiu do brief (regras R01 a R13) por SDD: PRD que conecta as features, uma spec/plano/contrato por feature, e o contrato como fonte da avaliação. As features foram construídas em waves conforme o grafo de dependências:
- Wave 1: F1 (contas e sessão). Wave 2: F2 (eventos). Wave 3: F3 (compra, vagas e pagamento).
- Wave 4, **paralela**: F4 (check-in), F5 (painel) e F6 (API de parceiros), cada uma numa branch (`feature/f4-check-in`, `feature/f5-painel`, `feature/f6-api-parceiros`) desenvolvida ao mesmo tempo em worktrees e integrada por merge na main. Os commits das três se entrelaçam no tempo (o primeiro de cada uma antecede o último das outras).

**Avaliação independente**: quem implementou uma feature não a avaliou. Um avaliador de contexto separado exercitou cada item do contrato (curl contra o stack vivo, mais o teste de concorrência em banco isolado, mais leitura de código) e escreveu um relatório por feature em `docs/avaliacoes/`, com veredito por item e evidência. Os relatórios não são editados depois de commitados; uma reprovação geraria um relatório novo. As seis features estão **aprovadas**.

## Estado
Produto completo: as seis features (F1 a F6) implementadas, integradas na main e aprovadas na avaliação independente (ver `docs/estado.json`). Um comando sobe tudo (`scripts/up.sh`), um roda todos os gates e testes (`scripts/gates.sh`, verde na main), um derruba (`scripts/down.sh`). O esquema Prisma completo (User, PartnerKey, Event, Ticket, Payment) entrou já na F1; as features seguintes só adicionaram comportamento.
