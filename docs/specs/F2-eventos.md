# F2 - Eventos (ciclo de vida)

## Spec

O organizador cria, edita, publica e cancela eventos. O evento nasce rascunho (fora da vitrine e da API); publicado e não cancelado aparece na vitrine e na API e aceita compra; cancelado é irreversível. Cada evento tem página de gestão com URL própria. F2 consome F1 (identidade do organizador) e provê a lotação e as vagas disponíveis (R05) que F3 e F5 consomem, e a lista de publicados que F6 expõe.

Realiza R01, R02, R03, R04, R11, R13. Modelo `Event` e ciclo de vida em [_CONVENCOES.md](_CONVENCOES.md).

## Plano

1. `domain/evento.ts`: invariantes (nome, `startsAt` futuro, local, `capacity`>=1, `priceCents`>0), máquina de estados (`draft`->`published`->`cancelled`), regra da lotação (nunca abaixo das ocupadas).
2. `repositories/event-repository.ts`: CRUD, contagem de ocupadas por evento (compartilhado com F3).
3. `services/event-service.ts`: `criar`, `editar`, `publicar`, `cancelar` (dispara a transição dos ingressos, R11), `listarDaVitrine`, `listarDoOrganizador`, `obterParaGestao` (checa dono, R13).
4. `http/event-routes.ts`: rotas de organizador (protegidas por `exigirPapel('organizer')` + dono) e a rota pública da vitrine.
5. `web/`: vitrine pública, formulário de criar/editar, página de gestão por URL própria.

Nota de fronteira: o `cancelar` transita ingressos (confirmed->refunded, pending->cancelled); essa transição pertence ao domínio de F3 e é chamada aqui. A prova da transição está nos contratos de F3/F5.

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F2-01 | Quando cria ou edita um evento, então exige nome, `startsAt` no futuro, local, `capacity` inteira >=1 e `priceCents` > 0; `startsAt` no passado é rejeitado. | Teste de validação no criar e no editar. | CF2.1 (R01) |
| C-F2-02 | Dado um evento recém-criado, então ele é `draft` e não aparece na vitrine nem na API nem aceita compra; só depois de publicado (e não cancelado) aparece. | Teste: vitrine e `/api/partner/events` só listam publicados; compra em draft falha. | CF2.2 (R02) |
| C-F2-03 | Quando tenta reduzir `capacity` abaixo das vagas ocupadas, então é rejeitado; aumentar é aceito. | Teste: com ocupadas=k, baixar para <k falha, subir passa. | CF2.3 (R03) |
| C-F2-04 | Quando muda `priceCents`, então ingressos já criados mantêm seu `pricePaidCents`; só compras posteriores usam o novo preço. | Teste: comprar, mudar preço, comprar de novo; os dois `pricePaidCents` diferem. | CF2.3 (R03) |
| C-F2-05 | Dado um evento, então existe uma página de gestão com URL própria para operá-lo. | Efeito: a rota de gestão responde por ID de evento. | CF2.4 (R04) |
| C-F2-06 | Dado um evento publicado, quando é cancelado, então o cancelamento é irreversível: sai da vitrine e da API, não vende, não edita nem republica. | Teste: após cancelar, publicar/editar/comprar falham; some da vitrine e da API. | CF2.5 (R11) |
| C-F2-07 | Dado um organizador autenticado, quando cria um evento, então ele é o dono; um participante tentando criar evento é recusado. | Teste: criar como participante é barrado; como organizador, o `organizerId` é o dele. | XF F2->F1 |
| C-F2-08 | Dado um organizador, quando acessa a área de organizador, então só vê e opera os próprios eventos, inclusive pela URL direta de gestão de um evento de outro. | Teste: organizador A acessando a gestão de evento de B é barrado. | CF2.6 (R13) |
