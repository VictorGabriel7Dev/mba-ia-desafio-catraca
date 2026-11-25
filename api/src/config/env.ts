// Única porta de leitura de process.env em toda a API.
// Nenhum outro módulo lê process.env diretamente: todos importam daqui.
import { z } from "zod";

const esquema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória"),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((item) => `  - ${item.path.join(".")}: ${item.message}`)
    .join("\n");
  throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
}

export const env = resultado.data;
