# F6 - API de parceiros

## Spec

Contrato fixo de três rotas com que um sistema parceiro vende ingressos; o avaliador conversa por linha de comando. Toda rota exige `X-Api-Key` (sem ela ou inválida -> `401 unauthorized`). As compras pela API valem para lotação, painel, check-in e cancelamento exatamente como as da vitrine. F6 consome F2 (eventos publicados), F3 (compra e ingresso) e F1 (chave). Não provê nada para outras features do produto; provê o contrato ao avaliador.

Realiza o contrato de parceiros e R06 pela API. Rotas, campos, códigos e ordem de erros em [_CONVENCOES.md](_CONVENCOES.md).

## Plano

1. `http/partner-routes.ts`: as três rotas, todas atrás de `exigirChaveParceiro` (F1).
   - `GET /api/partner/events` -> 200 com `[{id,name,startsAt,priceCents,availableSeats}]`, só publicados e não cancelados.
   - `POST /api/partner/events/{eventId}/purchases` com `{buyerEmail,cardNumber}` -> `202 {ticketId,code,status:"pending"}`; erros na ordem 422 `invalid_request`, 404 `event_not_available`, 409 `sold_out`.
   - `GET /api/partner/tickets/{ticketId}` -> 200 `{ticketId,code,eventId,status,checkedIn}`; inexistente -> 404 `ticket_not_found`.
2. Reaproveita `event-service` (listar publicados + availableSeats, F2) e `purchase-service` (comprar sem `buyerUserId`, F3); a feature é fina, é a casca do contrato.
3. Sem front: o cliente é o avaliador via `curl`.

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F6-01 | Quando `GET /api/partner/events` é chamado com chave válida, então lista só os publicados e não cancelados, cada um com `availableSeats` = vagas disponíveis. | `curl`: criar draft, publicado e cancelado; só o publicado aparece, com `availableSeats` certo. | XF F6->F2 |
| C-F6-02 | Quando `POST .../purchases` recebe corpo válido para evento com vaga, então retorna `202 {ticketId,code,status:"pending"}`; os erros saem na ordem 422 `invalid_request`, 404 `event_not_available`, 409 `sold_out`. | `curl`: corpo inválido (campo faltando, e-mail mal formado ou cartão != 16 dígitos) -> 422; evento rascunho/inexistente -> 404; cheio -> 409; válido -> 202. | CF6.1 (R06) |
| C-F6-03 | Quando `GET /api/partner/tickets/{ticketId}` é chamado, então retorna status e `checkedIn`; ingresso inexistente -> `404 ticket_not_found`. | `curl`: consultar um ingresso criado e um ID inexistente. | CF6.1 |
| C-F6-04 | Dada qualquer das três rotas, quando falta `X-Api-Key` ou ela é inválida, então retorna `401 unauthorized`. | `curl` nas três rotas sem chave e com chave inválida. | XF F6->F1 |
| C-F6-05 | Quando uma compra é feita pela API, então o ingresso criado conta na lotação, no painel, no check-in e no cancelamento como as da vitrine. | Teste: comprar pela API e ver a ocupação, o painel, o check-in e o estorno reagirem. | XF F6->F3 |
