# Imagem da API e do worker (mesmo código). Simples para o ambiente local do desafio.
FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro para aproveitar o cache de camada.
COPY package.json package-lock.json ./
RUN npm ci

# Gera o Prisma Client a partir do schema.
COPY prisma ./prisma
RUN npx prisma generate

# Código da aplicação.
COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

# Servidor por padrão; o serviço "worker" do compose troca o comando.
CMD ["npx", "tsx", "src/server.ts"]
