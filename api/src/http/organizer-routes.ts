// Area de organizador: gestao de eventos (F2). Toda rota exige sessao valida e
// papel "organizer"; o servico garante que o organizador so opera os proprios
// eventos (R13). A pagina de gestao responde por URL propria /events/:id (R04).
import { Router } from "express";
import * as eventos from "../services/event-service";
import * as checkin from "../services/checkin-service";
import { exigirSessao } from "./middlewares/exigir-sessao";
import { exigirPapel } from "./middlewares/exigir-papel";
import { envolver } from "./async";
import "./context";

export const organizerRoutes = Router();

organizerRoutes.use(exigirSessao, exigirPapel("organizer"));

// Lista apenas os eventos do organizador autenticado.
organizerRoutes.get(
  "/events",
  envolver(async (req, res) => {
    const lista = await eventos.listarDoOrganizador(req.sessao!.sub);
    res.status(200).json(lista);
  }),
);

organizerRoutes.post(
  "/events",
  envolver(async (req, res) => {
    const evento = await eventos.criar(req.sessao!.sub, req.body ?? {});
    res.status(201).json(evento);
  }),
);

// Pagina de gestao por URL propria (R04).
organizerRoutes.get(
  "/events/:id",
  envolver(async (req, res) => {
    const evento = await eventos.obterParaGestao(req.params.id, req.sessao!.sub);
    res.status(200).json(evento);
  }),
);

organizerRoutes.patch(
  "/events/:id",
  envolver(async (req, res) => {
    const evento = await eventos.editar(req.params.id, req.sessao!.sub, req.body ?? {});
    res.status(200).json(evento);
  }),
);

organizerRoutes.post(
  "/events/:id/publish",
  envolver(async (req, res) => {
    const evento = await eventos.publicar(req.params.id, req.sessao!.sub);
    res.status(200).json(evento);
  }),
);

organizerRoutes.post(
  "/events/:id/cancel",
  envolver(async (req, res) => {
    const evento = await eventos.cancelar(req.params.id, req.sessao!.sub);
    res.status(200).json(evento);
  }),
);

// Check-in de ingresso (F4, R10). So o dono do evento opera (R13, garantido pelo
// servico). Responde a mensagem de R10 e o estado do ingresso.
organizerRoutes.post(
  "/events/:id/checkin",
  envolver(async (req, res) => {
    const corpo = (req.body ?? {}) as { codigo?: unknown };
    const codigo = typeof corpo.codigo === "string" ? corpo.codigo : "";
    const resultado = await checkin.fazerCheckin(req.params.id, req.sessao!.sub, codigo);
    res.status(200).json(resultado);
  }),
);
