# Convenções compartilhadas das specs

Documento autoritativo que todas as specs de feature (F1 a F6) seguem. Fixa o formato de spec/plano/contrato, o glossário, o modelo de dados canônico, os códigos de erro e o formato dos relatórios de avaliação. Quando uma spec precisar de um nome de entidade, um status ou um código de erro, usa o daqui; não reinventa.

## Formato de cada spec de feature

Cada arquivo `docs/specs/FN-nome.md` tem, nesta ordem:

1. **Spec** (o quê e por quê): o comportamento da feature em prosa, o papel que a usa, o que ela provê e o que consome (as mesmas setas do grafo do PRD), e as regras do brief (R01 a R13) que ela realiza.
2. **Plano** (como): a lista de passos de implementação e os arquivos tocados (camadas: `domain`, `services`, `repositories`, `http`, `web`, `worker`), em ordem. O plano é o roteiro do agente que implementa a feature.
3. **Contrato** (prova): uma tabela de itens verificáveis. Cada item tem um ID (`C-FN-NN`), um enunciado no formato dado/quando/então, a forma de verificar (comando ou efeito observável) e o critério do PRD que ele cobre (`CF`/`XF`). Cada critério de aceite do PRD (CFx.y e XF) mapeia para pelo menos um item de contrato; os itens cross-feature ficam no contrato da feature que consome a dependência.

O contrato é a fonte da avaliação independente: o avaliador percorre item a item e dá veredito por item com evidência.

## Glossário

- **Papéis**: visitante (sem login, vê a vitrine), participante (cria a própria conta, compra, vê "Meus ingressos"), organizador (vem da seed, cria e opera eventos), parceiro (sistema externo, autentica por `X-Api-Key`).
- **Ciclo de vida do evento**: `draft` (rascunho, fora da vitrine e da API), `published` (na vitrine e na API, aceita compra), `cancelled` (irreversível, sai de tudo). Transições válidas: `draft -> published`, `draft -> cancelled`, `published -> cancelled`. Nunca sai de `cancelled`.
- **Status do ingresso** (rótulo PT / valor na API / quando): pendente / `pending` (compra criada, aguarda o gateway, já ocupa vaga); confirmado / `confirmed` (gateway aprovou); recusado / `declined` (gateway recusou, vaga liberada); cancelado / `cancelled` (estava `pending` quando o evento foi cancelado); estornado / `refunded` (estava `confirmed` quando o evento foi cancelado). `checkedIn` é um campo à parte (booleano), não um status.
- **Vaga ocupada**: ingresso em `pending` ou `confirmed`. Vagas disponíveis = lotação menos ocupadas; em evento cancelado, zero (R05).

## Modelo de dados canônico

Prisma + PostgreSQL. Entidades e campos (o esquema real em `api/prisma/schema.prisma` implementa isto):

- **User**: `id` (string), `name`, `email` (único), `passwordHash`, `role` (`participant` | `organizer`), `createdAt`.
- **PartnerKey**: `id`, `key` (único), `name`, `active` (bool). Vem da seed; o parceiro manda o valor em `X-Api-Key`.
- **Event**: `id`, `organizerId` (FK User), `name`, `startsAt` (timestamptz), `location`, `capacity` (int, >=1), `priceCents` (int, >0), `status` (`draft`|`published`|`cancelled`), `createdAt`, `updatedAt`.
- **Ticket**: `id`, `eventId` (FK Event), `code` (único, usado no check-in), `buyerEmail`, `buyerUserId` (FK User, nulo para compra via API de parceiros), `status` (enum acima), `pricePaidCents` (snapshot do preço do evento no momento da compra, R03), `checkedIn` (bool), `checkedInAt` (nulo), `createdAt`, `updatedAt`.
- **Payment**: `id`, `ticketId` (FK Ticket, único), `cardLast4` (4 dígitos), `outcome` (`approved`|`declined`, decidido na criação pela regra do cartão), `resolveAt` (timestamptz = criação + atraso sorteado na faixa do cartão), `processedAt` (nulo até o worker resolver). Nunca guarda o número completo do cartão.

Decisões que o modelo fixa:
- **R03 (preço)**: o preço vigente vai para `Ticket.pricePaidCents` na compra; mudar `Event.priceCents` depois não mexe em ingresso já criado.
- **R07 (sem overselling)**: a reserva de vaga é atômica. Na transação da compra, trava a linha do evento (`SELECT ... FOR UPDATE`), conta as ocupadas e só insere o ingresso `pending` se `ocupadas < capacity`; senão, `sold_out`. A trava por linha de evento serializa as compras concorrentes do mesmo evento.
- **Gateway assíncrono**: a compra nasce `pending` e responde na hora (R06). Um worker processa os `Payment` cujo `resolveAt` já passou e cujo ticket ainda está `pending`, transitando de forma **condicional** (`WHERE status = 'pending'`) para `confirmed` (outcome `approved`) ou `declined` (outcome `declined`, e libera a vaga). Resposta que chegue após o cancelamento não muda nada, porque o ticket já não está `pending` (R08, R11).

## Gateway simulado (modo padrão)

Decisão pelo final do número do cartão (16 dígitos; se não tiver 16 dígitos, rejeita antes de criar o ingresso, `422 invalid_request` na API):
- final `0001`: aprovado em 2 a 5s.
- final `0002`: recusado em 2 a 5s.
- final `0003`: aprovado em 30 a 40s.
- final `0004`: recusado em 30 a 40s.
- qualquer outro final: recusado em 2 a 5s.

O `outcome` e o `resolveAt` são calculados na criação da compra e gravados no `Payment`. O worker é a função pura `processarPagamentosVencidos(agora)`: isso deixa o teste adiantar o relógio (passar um `agora` no futuro) e provar R08 sem esperar segundos reais.

## Códigos de erro e respostas

- **API de parceiros** (corpo de erro sempre `{"error": "<codigo>"}`): `401 unauthorized` (sem `X-Api-Key` ou inválida), `422 invalid_request` (corpo inválido, inclusive cartão fora de 16 dígitos), `404 event_not_available` (evento inexistente, rascunho ou cancelado), `409 sold_out` (sem vaga), `404 ticket_not_found` (ingresso inexistente). Ordem de verificação na compra: 401 -> 422 -> 404 -> 409.
- **Vitrine/organizador** (front + rotas internas): sem vaga mostra "Ingressos esgotados"; o organizador só opera os próprios eventos (acesso negado nos de outro, inclusive por URL direta); visitante e participante não acessam a área de organizador.
- **Mensagens de check-in (R10)**, na ordem, a primeira verdadeira vence: "Ingresso inválido para este evento" (código inexistente ou de outro evento); "Evento cancelado"; "Ingresso não confirmado"; "Ingresso já utilizado"; "Entrada liberada".

## IDs e datas

IDs são string (cuid). Datas em ISO 8601 com fuso. Fora de escopo o fuso: o fluxo usa datas com pelo menos um dia de folga. Valores monetários em centavos inteiros (`priceCents`, `pricePaidCents`).

## Formato do relatório de avaliação independente

Um arquivo por rodada em `docs/avaliacoes/FN-<data>.md`, escrito por um agente de contexto separado (quem implementa não avalia), e **não alterado depois de commitado** (uma reprovação gera um relatório novo, não uma edição). Cada relatório tem: feature, data, commit avaliado (SHA), ferramenta e modelo do avaliador, e uma tabela item a item (ID do contrato, veredito `passou`/`falhou`, evidência: comando rodado e saída, ou efeito observado). Veredito final da feature: aprovado só se todos os itens passaram.

## Arquivo de estado do projeto

`docs/estado.json`: objeto com uma entrada por feature mapeando para `{ "status": "...", "relatorio": "docs/avaliacoes/FN-<data>.md" }`. O status bate com a realidade (uma feature só fica aprovada quando o relatório mais recente a aprova). Status possíveis: `pendente`, `em-implementacao`, `em-avaliacao`, `aprovada`, `reprovada`.
