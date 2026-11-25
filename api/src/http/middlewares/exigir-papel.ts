// Exige que a sessão tenha um papel específico (ex.: "organizer").
// Sem sessão responde 401; com sessão de papel errado responde 403.
import type { NextFunction, Request, Response } from "express";
import type { Papel } from "../../domain/usuario";
import "../context";

export function exigirPapel(papel: Papel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.sessao) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.sessao.role !== papel) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
