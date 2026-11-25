// Fábrica do app Express. Sem efeitos colaterais de rede (não abre porta):
// o server.ts e os testes usam esta função.
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "../config/env";
import { ErroAplicacao } from "../lib/errors";
import { authRoutes } from "./auth-routes";
import { partnerRoutes } from "./partner-routes";
import { organizerRoutes } from "./organizer-routes";
import { vitrineRoutes } from "./vitrine-routes";
import type { NextFunction, Request, Response } from "express";

export function criarApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/partner", partnerRoutes);
  app.use("/api/organizer", organizerRoutes);
  app.use("/api/events", vitrineRoutes);

  // 404 padrão.
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Handler central de erros.
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (erro instanceof ErroAplicacao) {
      res.status(erro.status).json({ error: erro.codigo });
      return;
    }
    console.error("Erro não tratado:", erro);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
