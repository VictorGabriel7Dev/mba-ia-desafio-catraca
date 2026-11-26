# Fluxo do avaliador (do zero)

Como subir, conferir e avaliar a Catraca partindo de um clone limpo. O avaliador precisa de Linux ou macOS com Docker, Git e Node.js LTS (testado no Node 20); no Windows, use o WSL.

## 1. Subir tudo (um comando)

```bash
cp .env.example .env     # ajuste DB_HOST_PORT se a 5432 já estiver ocupada na sua máquina
bash scripts/up.sh       # sobe db, api, worker e web; aplica as migrações; roda a seed; imprime endereços e contas
```

`up.sh` é idempotente (rodar de novo sem derrubar não quebra nem duplica a seed). No fim imprime os endereços (API em http://localhost:4000, Web em http://localhost:5173, Postgres) e as contas da seed (dois organizadores, um participante) e a chave de parceiro.

## 2. Rodar todos os gates (a barreira de regressão)

```bash
bash scripts/gates.sh
```

Um comando roda, sem parar no primeiro erro e saindo com código diferente de zero se algo falhar: lint (sem tolerância a aviso), typecheck e testes da API, e lint, typecheck e build do front. Os testes da API são de integração contra um Postgres de teste isolado (`catraca_test`), que o próprio `gates.sh` garante e migra. Os testes codificam os contratos das features (C-F1 a C-F6), inclusive o teste de concorrência de R07 (30 compras simultâneas numa lotação N resultam em exatamente N aceitas). **Verde na main significa sem regressão.** Esta é a verificação que, rodada na main ao final, pega qualquer quebra introduzida pela integração das waves.

## 3. Conferir o produto pela API (opcional, o que o avaliador independente fez)

Os relatórios em `docs/avaliacoes/FN-2026-11-25.md` trazem, item a item, os comandos `curl` usados e as respostas. Para repetir, use as contas da seed (ver `AGENTS.md`) e, por exemplo:

```bash
# listar eventos publicados pela API de parceiros
curl -H 'X-Api-Key: parceiro-demo-key-123' http://localhost:4000/api/partner/events

# login de organizador (devolve um token para usar em Authorization: Bearer)
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.organizadora@catraca.dev","password":"organizador123"}'
```

A relação completa de rotas, papéis e regras de camada está em `AGENTS.md`; o contrato de cada feature está em `docs/specs/FN-*.md`.

## 4. Mapa da rastreabilidade

- Brief (R01 a R13) para `docs/PRD.md` (features, grafo, waves, critérios CF/XF).
- Cada critério para pelo menos um item de contrato em `docs/specs/FN-*.md`.
- Cada item de contrato para um veredito com evidência em `docs/avaliacoes/FN-2026-11-25.md`.
- Situação de cada feature em `docs/estado.json`.

## 5. Derrubar

```bash
bash scripts/down.sh          # encerra os contêineres, preserva os dados
bash scripts/down.sh --tudo   # encerra e apaga o volume de dados
```
