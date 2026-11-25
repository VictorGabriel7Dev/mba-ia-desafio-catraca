// Exige uma sessão válida. Lê o token do cookie httpOnly "catraca_session" ou,
// como alternativa para clientes não-browser (curl, testes), do header
// Authorization: Bearer. Sem token válido responde 401 unauthorized.
import type { NextFunction, Request, Response } from "express";
import { verificarSessao } from "../../lib/token";
import "../context";

export const NOME_COOKIE_SESSAO = "catraca_session";

export function extrairToken(req: Request): string | null {
  const cookieToken = req.cookies?.[NOME_COOKIE_SESSAO];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  const header = req.header("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

export function exigirSessao(req: Request, res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  const sessao = token ? verificarSessao(token) : null;
  if (!sessao) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.sessao = sessao;
  next();
}
