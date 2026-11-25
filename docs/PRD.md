# PRD - Catraca (venda de ingressos para eventos pequenos)

Documento de produto que conecta as features. O brief da fundadora (regras R01 a R13) vira este PRD: a divisão em features, o que cada uma provê e consome, o grafo de dependências, as waves e os critérios de aceite - inclusive os que atravessam features.

## Visão

A Catraca vende ingressos para eventos pequenos (shows em bar, workshops, meetups). Visitantes veem a vitrine; participantes criam conta e compram; organizadores (vindos da seed) criam e operam eventos; parceiros vendem pela API. O pagamento passa por um gateway simulado, assíncrono. O risco do produto está na integração: features que funcionam sozinhas e quebram quando se encontram (evento cancelado que ainda deixa entrar, estorno somado como receita, 112 ingressos num show de 100). Por isso cada dependência tem um critério cross-feature.

## Stack (decisão)

- API em **Node.js + TypeScript + Express**, **PostgreSQL** (via Prisma), front em **React + Vite**. Gateway de pagamento **simulado** como serviço interno (sem chave real). Tudo em **docker-compose**, sobe com um comando.
- **R07 (sem overselling sob concorrência)**: reserva de vaga atômica no banco, numa transação que insere o ingresso só se `ocupadas < lotacao` (UPDATE condicional / `SELECT ... FOR UPDATE` no evento). A prova é a rajada de 30 compras simultâneas resultando em exatamente N `202` e o resto `409`.
- **Gateway assíncrono**: a compra nasce `pending` e responde na hora (R06); um worker processa o pagamento chamando o gateway simulado (resposta em 2-5s ou 30-40s conforme o final do cartão) e transita o ingresso de forma **condicional** (só `pending` -> `confirmed`/`declined`); resposta que chegue após cancelamento não muda o status (R08, R11).

## Features

| ID | Feature | Provê | Consome |
|---|---|---|---|
| **F1** | Contas e sessão | identidade autenticada + papel; validação de chave de parceiro | - |
| **F2** | Eventos (ciclo de vida) | eventos, vagas (R05), página de gestão; vitrine | F1 |
| **F3** | Compra, vagas e pagamento | ingressos + status; ocupação de vaga; código do ingresso | F2, F1 |
| **F4** | Check-in | resultado do check-in por código | F3, F2 |
| **F5** | Painel do evento | contagens do painel | F3, F2 |
| **F6** | API de parceiros | contrato fixo (3 rotas) | F2, F3, F1 |

### F1 - Contas e sessão
Participante cria a própria conta (nome, e-mail, senha), entra, sai. Organizador NÃO se cadastra pelo produto: as contas vêm da seed. Parceiro é autenticado por chave (`X-Api-Key`). Base de autorização de papel (participante, organizador) usada por F2-F6.
Regras: Quem usa; parte de R13 (visitante/participante não acessam a área de organizador).

### F2 - Eventos (ciclo de vida)
Organizador cria evento (R01: nome, início futuro, local, lotação >=1, preço > 0), edita, publica, cancela. Rascunho fica fora da vitrine e da API (R02). A lotação nunca fica menor que as vagas ocupadas; mudança de preço só vale para compras posteriores (R03). Cada evento tem página de gestão com URL própria (R04). Cancelamento é irreversível e dispara a transição dos ingressos (R11). Acesso restrito ao dono (R13).
Regras: R01, R02, R03, R04, R11, R13. Provê a lotação e as vagas disponíveis (R05) que F3/F5 consomem.

### F3 - Compra, vagas e pagamento
Compra de um ingresso (pela vitrine ou pela API de parceiros). A compra nasce `pending`, já ocupa vaga e responde sem esperar o gateway (R06). Vagas ocupadas = pending + confirmed; disponíveis = lotação - ocupadas (R05). Sem vaga, recusa (R07): vitrine "Ingressos esgotados", API `409 sold_out`; ocupadas nunca passam da lotação, nem sob concorrência. O gateway aprova -> `confirmed`; recusa -> `declined` + libera a vaga (R08). Cada ingresso tem código único usado no check-in (R09).
Regras: R05, R06, R07, R08, R09. Provê ingressos e status para F4/F5/F6.

### F4 - Check-in
Na página de gestão, o organizador informa o código de um ingresso; a primeira situação verdadeira da lista define a mensagem (R10): código inexistente/de outro evento -> "Ingresso inválido para este evento"; evento cancelado -> "Evento cancelado"; não confirmado -> "Ingresso não confirmado"; já usado -> "Ingresso já utilizado"; senão -> "Entrada liberada".
Regras: R10. Consome o status/código do ingresso (F3) e o estado do evento (F2).

### F5 - Painel do evento
A página de gestão mostra: Confirmados (confirmados, inclusive os que já fizeram check-in), Pendentes, Check-ins (confirmados que fizeram check-in), Vagas disponíveis (R05), Receita (soma do valor pago pelos confirmados, com o preço vigente em cada compra), Estornados (R12).
Regras: R12. Consome ingressos (F3) e a lotação/preço do evento (F2).

### F6 - API de parceiros
Contrato fixo (o avaliador conversa por linha de comando). Toda rota exige `X-Api-Key` (sem/invalida -> `401 unauthorized`). `GET /api/partner/events` (publicados e não cancelados, com `availableSeats` = R05); `POST /api/partner/events/{eventId}/purchases` (-> `202 pending`; erros na ordem: `422 invalid_request`, `404 event_not_available`, `409 sold_out`); `GET /api/partner/tickets/{ticketId}` (-> status/checkedIn; inexistente `404 ticket_not_found`). Compras pela API valem para lotação, painel, check-in e cancelamento como as da vitrine.
Regras: contrato de parceiros; R06 pela API. Consome eventos (F2), compra/ingresso (F3) e a chave (F1).

## Grafo de dependências e waves

```
F1 ──▶ F2 ──▶ F3 ──┬──▶ F4
                   ├──▶ F5
                   └──▶ F6
```

- **Wave 1**: F1 (fundação; ninguém depende de nada ainda).
- **Wave 2**: F2 (depende de F1).
- **Wave 3**: F3 (depende de F2 e F1).
- **Wave 4 (PARALELA)**: **F4 + F5 + F6** - as três dependem de F3 (e F2), mas são independentes entre si; implementadas ao mesmo tempo, cada uma na sua branch (worktree), integradas à `main` por PRs. É a wave que prova desenvolvimento paralelo.

## Critérios de aceite por feature

### F1
- CF1.1 Participante se cadastra (nome, e-mail, senha), entra e sai; e-mail duplicado é rejeitado. (R - Quem usa)
- CF1.2 Organizador NÃO pode se cadastrar pelo produto; as contas da seed entram. (fora de escopo: cadastro de organizador)
- CF1.3 Rota de parceiro sem `X-Api-Key` ou com chave inválida responde `401 unauthorized`. (contrato)
- CF1.4 Visitante e participante não acessam a área de organizador. (**R13**)

### F2
- CF2.1 Evento exige nome, início no futuro, local, lotação inteira >=1 e preço > 0, ao criar e ao editar; início no passado é rejeitado. (**R01**)
- CF2.2 Evento nasce rascunho; só publicado e não cancelado aparece na vitrine e na API e aceita compra. (**R02**)
- CF2.3 Reduzir a lotação abaixo das vagas ocupadas é rejeitado; aumentar é aceito; mudança de preço só vale para compras posteriores. (**R03**)
- CF2.4 Cada evento tem página de gestão com URL própria. (**R04**)
- CF2.5 Cancelar evento publicado é irreversível: sai da vitrine e da API, não vende, não edita nem republica. (**R11**)
- CF2.6 Na área de organizador, cada organizador só vê e opera os próprios eventos, inclusive pela URL direta de gestão de evento de outro. (**R13**)

### F3
- CF3.1 Vagas ocupadas = pending + confirmed; disponíveis = lotação - ocupadas; em evento cancelado, zero. (**R05**)
- CF3.2 Compra nasce pending, ocupa vaga e responde sem esperar o gateway. (**R06**)
- CF3.3 Sem vaga, a vitrine exibe "Ingressos esgotados" e a API responde `409 sold_out`; ocupadas nunca passam da lotação, **inclusive sob 30 compras simultâneas** (exatamente N `202` e o resto `409`). (**R07**)
- CF3.4 Gateway aprova -> confirmed; recusa -> declined e libera a vaga. (**R08**)
- CF3.5 Cada ingresso tem código único; "Meus ingressos" mostra evento, status e código. (**R09**)

### F4
- CF4.1 O check-in exibe a mensagem exata de cada situação da lista ordenada de R10. (**R10**)

### F5
- CF5.1 Cada número do painel (Confirmados, Pendentes, Check-ins, Vagas disponíveis, Receita, Estornados) bate com o estado dos ingressos. (**R12**)

### F6
- CF6.1 As três rotas seguem o contrato fixo (campos, status HTTP, códigos de erro) e a ordem de verificação dos erros da compra. (contrato; **R06** pela API)

## Critérios cross-feature (um por dependência do grafo)

- **XF F2->F1**: um evento só é criado por um organizador autenticado; participante criando evento recebe recusa (área de organizador). (liga CF2.x a F1)
- **XF F3->F2**: comprar um evento em rascunho ou cancelado falha (`404 event_not_available` pela API; vitrine não oferece); comprar além da lotação do evento publicado dá `sold_out`. (prova que a publicação/lotação de F2 chega em F3)
- **XF F3->F1**: compra pela vitrine fica vinculada à conta do participante e aparece em "Meus ingressos"; compra pela API não vincula a conta, mas conta para lotação/painel/check-in/cancelamento. (prova que a identidade de F1 chega em F3)
- **XF F4->F3**: check-in de ingresso `confirmed` -> "Entrada liberada"; de `pending` -> "Ingresso não confirmado"; segundo check-in do mesmo -> "Ingresso já utilizado". (prova que o status de F3 chega em F4)
- **XF F4->F2**: check-in num evento cancelado -> "Evento cancelado". (prova que o estado do evento de F2 chega em F4)
- **XF F5->F3**: após uma compra confirmar, o painel incrementa Confirmados e Receita; após cancelar o evento, Estornados reflete os que estavam confirmados. (prova que os ingressos de F3 chegam em F5)
- **XF F5->F2**: "Vagas disponíveis" do painel = lotação de F2 menos as ocupadas de F3; após aumentar a lotação, o número sobe. (liga F2 e F3 em F5)
- **XF F6->F2**: `GET /api/partner/events` lista só os publicados e não cancelados, com `availableSeats` = vagas disponíveis. (prova F2 em F6)
- **XF F6->F3**: compra pela API cria ingresso via F3 e conta na lotação, no painel, no check-in e no cancelamento como as da vitrine. (prova F3 em F6)
- **XF F6->F1**: as três rotas de parceiro exigem chave válida (`401` sem ela). (prova F1 em F6)

## Fora de escopo

Deploy e qualquer ambiente além do local. Gateway de pagamento real, e-mail e notificações. App mobile e qualidade visual (nenhum critério avalia design). Cadastro de organizador pelo produto. Mais de um ingresso por compra, mapa de assentos, cancelamento ou transferência de ingresso pelo participante. Atualização em tempo real (recarregar a página basta). Fuso horário (o fluxo usa datas com pelo menos um dia de folga).
