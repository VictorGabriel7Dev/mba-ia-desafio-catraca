# F4 - Check-in

## Spec

Na página de gestão, o organizador informa o código de um ingresso e recebe uma mensagem. A lista de situações de R10 é ordenada e a primeira verdadeira define a mensagem. F4 consome F3 (status e código do ingresso) e F2 (estado do evento). Não provê nada para outras features.

Realiza R10. Mensagens exatas (na ordem) em [_CONVENCOES.md](_CONVENCOES.md): "Ingresso inválido para este evento"; "Evento cancelado"; "Ingresso não confirmado"; "Ingresso já utilizado"; "Entrada liberada".

## Plano

1. `domain/checkin.ts`: função pura que, dado o ingresso (ou ausência), o evento e o código pedido, retorna a mensagem pela ordem de R10. O primeiro check-in bem-sucedido marca `checkedIn`/`checkedInAt`.
2. `services/checkin-service.ts`: busca o ingresso pelo código no escopo do evento, aplica a decisão, grava o check-in quando "Entrada liberada".
3. `http`: rota de check-in dentro da gestão do evento (protegida por dono, R13).
4. `web/`: campo de código e exibição da mensagem na página de gestão.

Fronteira: usa o `Ticket` (F3) e o `Event.status` (F2); não altera o modelo deles, só lê e marca `checkedIn`.

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F4-01 | Dado um código inexistente ou de outro evento, quando faz o check-in, então a mensagem é "Ingresso inválido para este evento". | Teste da função de decisão e da rota. | CF4.1 (R10) |
| C-F4-02 | Dado um evento cancelado, quando faz o check-in de um ingresso dele, então a mensagem é "Evento cancelado" (vence sobre as situações de status do ingresso). | Teste: evento cancelado, ingresso confirmado -> "Evento cancelado". | XF F4->F2 |
| C-F4-03 | Dado um ingresso `pending`, quando faz o check-in, então a mensagem é "Ingresso não confirmado". | Teste: ingresso pending -> "Ingresso não confirmado". | XF F4->F3 |
| C-F4-04 | Dado um ingresso `confirmed` ainda não usado, quando faz o check-in, então a mensagem é "Entrada liberada" e `checkedIn` passa a verdadeiro; um segundo check-in do mesmo retorna "Ingresso já utilizado". | Teste: primeiro check-in libera, segundo acusa já utilizado. | CF4.1 / XF F4->F3 (R10) |
