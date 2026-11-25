// Vitrine publica (F2): lista de eventos publicados e o detalhe de um evento
// publicado. Sem autenticacao (visitante). Rascunho e cancelado nao aparecem:
// o detalhe de um evento nao publicado responde 404 event_not_available.
import { Router } from "express";
import * as eventos from "../services/event-service";
import { envolver } from "./async";

export const vitrineRoutes = Router();

vitrineRoutes.get(
  "/",
  envolver(async (_req, res) => {
    const lista = await eventos.listarVitrine();
    res.status(200).json(lista);
  }),
);

vitrineRoutes.get(
  "/:id",
  envolver(async (req, res) => {
    const evento = await eventos.obterPublicado(req.params.id);
    res.status(200).json(evento);
  }),
);
