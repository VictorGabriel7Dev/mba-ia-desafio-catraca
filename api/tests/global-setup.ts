// Setup único da suíte: garante o schema aplicado no banco de teste.
// Roda uma vez antes de todos os arquivos de teste.
import { execSync } from "node:child_process";

export default function globalSetup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Rode os testes via scripts/gates.sh (sobe o Postgres de teste).",
    );
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
