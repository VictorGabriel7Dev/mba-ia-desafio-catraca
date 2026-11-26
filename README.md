# Catraca

Desafio 311 (MBA Eng. de Software com IA, FullCycle): do brief ao produto em modo agente. Venda de ingressos para eventos pequenos (shows em bar, workshops, meetups). O produto inteiro foi construído do zero, a partir do brief (regras R01 a R13), por agentes, com especificações que se conectam e cada feature aprovada por um avaliador que não foi quem a implementou.

## Como rodar

Pré-requisitos: Linux ou macOS com **Docker**, **Git** e **Node.js LTS** (testado no Node 20). No Windows, use o WSL.

```bash
cp .env.example .env     # opcional: up.sh faz isso sozinho na primeira vez. Ajuste DB_HOST_PORT se a 5432 estiver ocupada
bash scripts/up.sh       # sobe tudo a partir de um clone limpo, migra, carrega a seed e imprime endereços e contas
bash scripts/gates.sh    # roda todos os gates e os testes automatizados (passa na main)
bash scripts/down.sh     # derruba tudo que a subida iniciou (use --tudo para apagar os dados)
```

`up.sh` é idempotente: rodar de novo sem derrubar não quebra nem duplica a seed. O modo padrão usa o gateway de pagamento **simulado**, sem nenhuma chave real.

## Endereços

A subida imprime os endereços; por padrão:

- Produto (front, `$WEB`): http://localhost:5173
- API de parceiros (`$API`): http://localhost:4000 (ex.: `GET $API/api/partner/events`)
- Postgres: localhost:5432 (ou o `DB_HOST_PORT` do seu `.env`)

## Credenciais (da seed)

| Papel | E-mail | Senha |
|---|---|---|
| Organizador A | `ana.organizadora@catraca.dev` | `organizador123` |
| Organizador B | `bruno.organizador@catraca.dev` | `organizador123` |
| Participante | `carla.participante@catraca.dev` | `participante123` |

Chave de parceiro (cabeçalho `X-Api-Key`): **`parceiro-demo-key-123`**

Participantes também podem criar a própria conta pela interface; organizadores só vêm da seed (R13).

## Mapa dos artefatos

- `docs/PRD.md` - visão, 6 features, o que cada uma provê e consome, grafo de dependências, waves e critérios de aceite (inclusive os cross-feature), citando R01 a R13, e a seção de fora de escopo.
- `docs/specs/` - a spec, o plano e o contrato de cada feature (`F1-*.md` a `F6-*.md`) e as convenções compartilhadas (`_CONVENCOES.md`).
- `docs/avaliacoes/` - um relatório de avaliação independente por feature (`F1-2026-11-25.md` a `F6-2026-11-25.md`), com veredito por item e evidência.
- `docs/estado.json` - o estado de cada feature e o caminho do relatório mais recente.
- `docs/FLUXO-DO-AVALIADOR.md` - como subir, rodar os gates e conferir o produto do zero.
- `AGENTS.md` - porta de entrada dos agentes: comandos, contas, regras de camada e mapa.

PRs da wave paralela (F4, F5 e F6, integradas por PR): `feature/f4-check-in`, `feature/f5-painel`, `feature/f6-api-parceiros`. Os links dos PRs no GitHub entram aqui na publicação do repositório; os commits de cada PR se entrelaçam no tempo (o primeiro de cada um antecede o último dos outros).

## Decisões

- **Stack e por quê**: Node.js + TypeScript + Express, PostgreSQL via Prisma, front em React + Vite, tudo em docker-compose e subindo com um comando. Escolha pela familiaridade do time e porque a máquina do avaliador tem Node LTS e Docker; nada além do Node precisa rodar fora de container.
- **R07 (sem overselling sob concorrência)**: a reserva de vaga é atômica. Na transação da compra, a linha do evento é travada (`SELECT ... FOR UPDATE`), as vagas ocupadas são contadas e o ingresso só é inserido se `ocupadas < lotação`; senão, `sold_out`. A trava por linha de evento serializa as compras concorrentes do mesmo evento. Provado disparando 30 compras simultâneas numa lotação N e vendo exatamente N respostas de sucesso e o resto `sold_out` (teste de contrato C-F3-04, repetido várias vezes).
- **Resposta assíncrona do gateway**: a compra nasce `pending` e responde na hora (R06). Na criação, grava-se um `Payment` com o resultado e o instante de resolução (`resolveAt`), derivados do final do cartão. Um worker separado processa os pagamentos vencidos de forma **condicional** (só `pending` vira `confirmed`/`declined`), então uma resposta que chegue depois do cancelamento não muda o status (R08, R11).
- **Isolamento da avaliação**: quem implementou uma feature não a avaliou. Cada feature foi avaliada por um agente de contexto separado, que exercitou o contrato (curl contra o produto no ar, teste de concorrência em banco isolado e leitura de código) e escreveu um relatório que não é alterado depois de commitado.

## Processo (desenvolvimento em modo agente)

O produto saiu do brief por SDD: PRD que conecta as features, uma spec/plano/contrato por feature e o contrato como fonte da avaliação. As features foram construídas em waves conforme o grafo:

- Wave 1: F1 (contas e sessão). Wave 2: F2 (eventos). Wave 3: F3 (compra, vagas e pagamento).
- Wave 4, **paralela**: F4 (check-in), F5 (painel) e F6 (API de parceiros), cada uma na sua branch e worktree ao mesmo tempo, integradas à main por PR.

## Regras de entrega

Um projeto por repositório. Os PRs da wave paralela continuam visíveis no GitHub mesmo depois do merge (as branches podem ser apagadas). Tudo fica na branch `main`.

## Estado

Produto completo: as seis features (F1 a F6) implementadas, integradas na main e aprovadas na avaliação independente (ver `docs/estado.json`). O comando de gates passa na main com os testes automatizados; o fluxo do avaliador do zero foi provado em um clone limpo.
