# F3 - Compra, vagas e pagamento

## Spec

O coração do produto e o ponto de maior risco de integração. Uma compra (pela vitrine ou pela API de parceiros) cria um ingresso: nasce `pending`, já ocupa vaga e responde sem esperar o gateway (R06). Vagas ocupadas = `pending` + `confirmed`; disponíveis = lotação menos ocupadas; em evento cancelado, zero (R05). Sem vaga, recusa (R07): vitrine "Ingressos esgotados", API `409 sold_out`; as ocupadas nunca passam da lotação, nem sob concorrência. O gateway aprova -> `confirmed`; recusa -> `declined` e libera a vaga (R08). Cada ingresso tem código único usado no check-in (R09). F3 consome F2 (evento, lotação) e F1 (identidade); provê ingressos e status para F4, F5 e F6.

Realiza R05, R06, R07, R08, R09. Modelos `Ticket`/`Payment`, gateway simulado e reserva atômica em [_CONVENCOES.md](_CONVENCOES.md).

## Plano

1. `domain/ingresso.ts`: enum de status, transições condicionais (`pending`->`confirmed`/`declined`; cancelar leva `confirmed`->`refunded`, `pending`->`cancelled`), geração de código único.
2. `domain/gateway-sim.ts`: função pura que decide `outcome` e atraso pelo final do cartão; valida os 16 dígitos.
3. `repositories/ticket-repository.ts`, `repositories/payment-repository.ts`: contagem de ocupadas, reserva atômica (`SELECT ... FOR UPDATE` no evento + insert condicional), transições condicionais.
4. `services/purchase-service.ts`: `comprar(eventoId, buyerEmail, cardNumber, buyerUserId?)` numa transação; cria `Ticket` pending + `Payment` com `resolveAt`.
5. `worker/`: `processarPagamentosVencidos(agora)` (função pura testável); loop que a chama periodicamente.
6. `services/cancel-tickets.ts`: transição em lote no cancelamento do evento (chamada por F2).
7. `web/`: botão comprar na vitrine, "Ingressos esgotados", tela "Meus ingressos" (evento, status, código).

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F3-01 | Dado um evento publicado com lotação N, então ocupadas = `pending`+`confirmed` e disponíveis = N menos ocupadas; num evento cancelado, disponíveis = 0. | Teste: contagem após compras em vários status. | CF3.1 (R05) |
| C-F3-02 | Quando uma compra é feita, então o ingresso nasce `pending`, já ocupa vaga e a resposta volta sem esperar o gateway. | Teste: a resposta é imediata e o status inicial é `pending`. | CF3.2 (R06) |
| C-F3-03 | Dado um evento lotado, quando se tenta comprar, então a vitrine mostra "Ingressos esgotados" e a API responde `409 sold_out`. | Teste + `curl`: compra em evento cheio. | CF3.3 (R07) |
| C-F3-04 | Dado um evento com lotação N, quando chegam 30 compras simultâneas, então exatamente N são aceitas (`pending`) e as demais recebem `sold_out`; as ocupadas nunca passam de N. | Teste de concorrência: 30 requisições em paralelo, conta aceitas e rejeitadas. | CF3.3 (R07) |
| C-F3-05 | Quando o gateway aprova (cartão final 0001/0003), então o ingresso vira `confirmed`; quando recusa (0002/0004/outro), vira `declined` e a vaga é liberada. | Teste: `processarPagamentosVencidos` com relógio adiantado, por tipo de cartão. | CF3.4 (R08) |
| C-F3-06 | Dado um ingresso que já saiu de `pending` (cancelado), quando a resposta do gateway chega depois, então o status não muda. | Teste: cancelar antes de processar; o processamento não reverte. | R08/R11 |
| C-F3-07 | Dado um ingresso, então ele tem código único; "Meus ingressos" mostra evento, status e código. | Teste: códigos distintos; a tela lista os três campos. | CF3.5 (R09) |
| C-F3-08 | Quando se tenta comprar um evento em rascunho ou cancelado, então falha: `404 event_not_available` pela API, e a vitrine não oferece. | `curl` na API; teste na vitrine. | XF F3->F2 |
| C-F3-09 | Quando a compra é pela vitrine, então fica vinculada à conta do participante e aparece em "Meus ingressos"; quando é pela API, não vincula conta, mas conta para lotação, painel, check-in e cancelamento. | Teste: `buyerUserId` preenchido na vitrine, nulo na API; ambas entram nas contagens. | XF F3->F1 |
