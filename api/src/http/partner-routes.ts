// Rotas da API de parceiros. Em F1 existe apenas um stub protegido por
// exigirChaveParceiro, para provar o middleware de chave (C-F1-05 / CF1.3).
// F6 preenche o contrato real (events, purchases, tickets).
import { Router } from "express";
import { exigirChaveParceiro } from "./middlewares/exigir-chave-parceiro";
import { envolver } from "./async";

export const partnerRoutes = Router();

// Toda rota de parceiro exige X-Api-Key válida.
partnerRoutes.use(envolver(exigirChaveParceiro));

// Stub: com chave válida responde 200 com lista vazia; F6 lista os eventos reais.
partnerRoutes.get("/events", (_req, res) => {
  res.status(200).json([]);
});
