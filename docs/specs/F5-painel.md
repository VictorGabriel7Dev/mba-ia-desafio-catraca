# F5 - Painel do evento

## Spec

A página de gestão mostra os números do evento: Confirmados (ingressos `confirmed`, inclusive os que já fizeram check-in), Pendentes (`pending`), Check-ins (`confirmed` com `checkedIn`), Vagas disponíveis (R05), Receita (soma de `pricePaidCents` dos confirmados, com o preço vigente em cada compra) e Estornados (`refunded`). F5 consome F3 (ingressos e status) e F2 (lotação e preço). Não provê nada para outras features.

Realiza R12. Definições de contagem e de "ocupada" em [_CONVENCOES.md](_CONVENCOES.md).

## Plano

1. `services/stats-service.ts`: calcula as seis contagens a partir dos ingressos do evento (uma consulta agregada por status + soma de `pricePaidCents` dos confirmados).
2. `http`: rota de painel dentro da gestão do evento (protegida por dono, R13).
3. `web/`: bloco de números na página de gestão.

Fronteira: só leitura sobre `Ticket` (F3) e `Event` (F2); Receita usa `pricePaidCents` do ingresso, nunca o `priceCents` atual do evento.

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F5-01 | Dado um evento com ingressos em vários status, então Confirmados, Pendentes, Check-ins, Vagas disponíveis, Receita e Estornados batem com o estado dos ingressos. | Teste: montar um cenário conhecido e conferir os seis números. | CF5.1 (R12) |
| C-F5-02 | Quando uma compra confirma, então Confirmados e Receita incrementam; quando o evento é cancelado, então Estornados passa a refletir os que estavam confirmados. | Teste: confirmar e checar o delta; cancelar e checar Estornados. | XF F5->F3 |
| C-F5-03 | Dada a lotação do evento, então Vagas disponíveis = lotação menos ocupadas; quando a lotação aumenta, o número sobe. | Teste: aumentar `capacity` e ver Vagas disponíveis subir. | XF F5->F2 |
| C-F5-04 | Dado que o preço do evento mudou entre duas compras, então a Receita soma o `pricePaidCents` de cada ingresso, não o preço atual do evento. | Teste: comprar, mudar preço, comprar, confirmar ambos; Receita = soma dos dois preços pagos. | R12 (R03) |
