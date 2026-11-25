// Exige uma chave de parceiro ativa no header X-Api-Key.
// Sem chave ou com chave inválida/inativa responde 401 unauthorized.
import type { NextFunction, Request, Response } from "express";
import * as chaves from "../../repositories/partner-key-repository";
import "../context";

export async function exigirChaveParceiro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const chave = req.header("x-api-key");
  if (!chave) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const parceiro = await chaves.buscarAtivaPorChave(chave);
  if (!parceiro) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.parceiro = { id: parceiro.id, name: parceiro.name };
  next();
}
