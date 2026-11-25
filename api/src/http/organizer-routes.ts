// Área de organizador. Em F1 há apenas um stub protegido por sessão + papel,
// para provar a barreira de autorização (C-F1-04 / CF1.4 / R13).
// F2 preenche a gestão de eventos.
import { Router } from "express";
import { exigirSessao } from "./middlewares/exigir-sessao";
import { exigirPapel } from "./middlewares/exigir-papel";

export const organizerRoutes = Router();

organizerRoutes.use(exigirSessao, exigirPapel("organizer"));

// Stub: visível apenas para organizador autenticado.
organizerRoutes.get("/events", (_req, res) => {
  res.status(200).json([]);
});
