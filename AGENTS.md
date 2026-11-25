# Catraca - porta de entrada dos agentes

Venda de ingressos para eventos pequenos. Monorepo Node/TS + Express + Prisma/PostgreSQL + React/Vite, tudo em docker-compose.

## Comandos (um sobe, um derruba, um valida)
- `bash scripts/up.sh` - sobe tudo do zero (build, banco, migrações, seed idempotente) e imprime os endereços e contas.
- `bash scripts/down.sh` - derruba mantendo os dados; `bash scripts/down.sh --tudo` apaga o volume.
- `bash scripts/gates.sh` - roda todos os gates (api: lint, typecheck, test; web: lint, typecheck, build). Sai != 0 se algum falhar; na main com F1 pronto passa 100%.

## Endereços
- API http://localhost:4000 (saude em `/health`) - Web http://localhost:5173 - Postgres localhost:5432.

## Contas da seed (senhas conhecidas, modo simulado sem chave externa)
- organizador: `ana.organizadora@catraca.dev` / `organizador123`
- organizador: `bruno.organizador@catraca.dev` / `organizador123`
- participante: `carla.participante@catraca.dev` / `participante123`
- chave de parceiro (header `X-Api-Key`): `parceiro-demo-key-123`

## Sessão
JWT em cookie httpOnly `catraca_session`. Para clientes não-browser (curl, testes) o mesmo token volta no corpo do login/register e é aceito em `Authorization: Bearer <token>`. Hash de senha com bcrypt (bcryptjs).

## Regras de camada (API)
- `domain/` - regras puras; não importa infraestrutura (sem Prisma, Express ou env).
- `repositories/` - única porta do Prisma; serviços e rotas nunca importam `@prisma/client` direto.
- `services/` - orquestra domínio e repositórios; nunca toca em Prisma nem Express.
- `http/` - rotas e middlewares (`exigirSessao`, `exigirPapel`, `exigirChaveParceiro`).
- `config/` - único lugar que lê `process.env` (`src/config/env.ts`, validado com zod).
- `web/` não importa de `api/`; fala com a API por HTTP (`web/src/lib/api.ts`).

## Mapa das pastas
- `api/` - Express + Prisma. `src/{config,domain,repositories,services,http,lib}`, `prisma/{schema.prisma,seed.ts,migrations}`, `tests/`.
- `web/` - React + Vite. `src/{pages,lib}`.
- `scripts/` - `up.sh`, `down.sh`, `gates.sh`.
- `docs/specs/` - specs/contratos (contrato, não editar). `docs/PRD.md` - visão. `docs/avaliacoes/` - relatórios. `docs/estado.json` - estado por feature.

## Estado atual
F1 (contas e sessão) implementada e testada. Schema Prisma completo (User, PartnerKey, Event, Ticket, Payment) já entra na F1; F2 a F6 só adicionam comportamento. Worker é no-op até a F3.
