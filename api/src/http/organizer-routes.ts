// Area de organizador: gestao de eventos (F2). Toda rota exige sessao valida e
// papel "organizer"; o servico garante que o organizador so opera os proprios
// eventos (R13). A pagina de gestao responde por URL propria /events/:id (R04).
import { Router } from "express";
import * as eventos from "../services/event-service";
import * as stats from "../services/stats-service";
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

// Painel do evento (F5, R12): os seis numeros, restrito ao dono (R13).
organizerRoutes.get(
  "/events/:id/painel",
  envolver(async (req, res) => {
    const painel = await stats.painelDoEvento(req.params.id, req.sessao!.sub);
    res.status(200).json(painel);
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
