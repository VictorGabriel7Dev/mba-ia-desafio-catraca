import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testes de integração sobem o Express e falam com o Postgres de teste;
    // rodam em um único worker para serializar o estado do banco entre arquivos.
    environment: "node",
    // DATABASE_URL vem de fora (scripts/gates.sh aponta para o banco de teste).
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "segredo-de-teste",
      WEB_ORIGIN: "http://localhost:5173",
    },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
