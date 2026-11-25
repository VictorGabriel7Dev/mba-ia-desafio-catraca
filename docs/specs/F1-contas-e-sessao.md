# F1 - Contas e sessão

## Spec

Fundação de identidade e autorização. O participante cria a própria conta (nome, e-mail, senha), entra e sai; o organizador não se cadastra pelo produto (vem da seed); o parceiro é autenticado por chave em `X-Api-Key`. F1 provê a identidade autenticada com papel (participante, organizador) e a validação da chave de parceiro, consumidos por F2 a F6. Não consome ninguém.

Realiza parte de R13: a base de autorização que impede visitante e participante de acessar a área de organizador. Ver o glossário de papéis e o modelo `User`/`PartnerKey` em [_CONVENCOES.md](_CONVENCOES.md).

## Plano

1. `api/prisma/schema.prisma`: modelos `User` (com `role`) e `PartnerKey`.
2. `domain/usuario.ts`: papéis, regra de e-mail único, política de senha mínima.
3. `repositories/user-repository.ts`, `repositories/partner-key-repository.ts`.
4. `services/auth-service.ts`: `registrarParticipante`, `login`, `me`, `logout`; hash de senha; nunca cria organizador.
5. `http/auth-routes.ts` (register/login/me/logout) e `http/middlewares/`: `exigirSessao`, `exigirPapel('organizer')`, `exigirChaveParceiro` (lê `X-Api-Key`, valida contra `PartnerKey.active`).
6. `web/`: telas de cadastro e login do participante; guarda de rota para a área de organizador.
7. Seed: 2 organizadores + 1 participante + 1 `PartnerKey` ativa (idempotente).

## Contrato

| ID | Dado / Quando / Então | Como verificar | Cobre |
|---|---|---|---|
| C-F1-01 | Dado um e-mail novo, quando o participante se cadastra (nome, e-mail, senha), faz login e chama `me`, então recebe a própria identidade com papel `participant`; logout encerra a sessão. | Teste de integração nas rotas de auth. | CF1.1 |
| C-F1-02 | Dado um e-mail já cadastrado, quando tenta cadastrar de novo, então é rejeitado. | Teste: segundo register com mesmo e-mail retorna erro. | CF1.1 |
| C-F1-03 | Quando se tenta criar um organizador pelo produto (register pedindo papel `organizer`), então é recusado; os organizadores existentes vêm só da seed. | Teste: register não aceita virar organizador; a seed cria os organizadores. | CF1.2 |
| C-F1-04 | Dado um visitante (sem sessão) ou um participante, quando acessa uma rota da área de organizador, então recebe 401/403 e não entra. | Teste: rota de organizador sem sessão e com sessão de participante é barrada. | CF1.4 (R13) |
| C-F1-05 | Dada uma rota de parceiro, quando a requisição não traz `X-Api-Key` ou traz chave inválida, então recebe `401 unauthorized`; com a chave da seed, passa. | `curl` nas rotas `/api/partner/*` sem chave, com chave inválida e com a da seed. | CF1.3 |
