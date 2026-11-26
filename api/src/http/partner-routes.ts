// Rotas da API de parceiros (F6). Contrato fixo de tres rotas com que um sistema
// externo vende ingressos; o avaliador conversa por curl. Toda rota exige a
// X-Api-Key valida (middleware exigirChaveParceiro, F1): sem ela ou invalida ->
// 401 unauthorized. A feature e fina: e a casca do contrato, reusa event-service
// e purchase-service. Campos, codigos e ordem de erros em docs/specs/_CONVENCOES.md
// (ordem na compra: 401 -> 422 -> 404 -> 409).
import { Router } from "express";
import * as eventoService from "../services/event-service";
import * as compras from "../services/purchase-service";
import { exigirChaveParceiro } from "./middlewares/exigir-chave-parceiro";
import { envolver } from "./async";
import { ErroAplicacao } from "../lib/errors";
import "./context";

export const partnerRoutes = Router();

// Toda rota de parceiro exige X-Api-Key valida (401 unauthorized caso contrario).
partnerRoutes.use(envolver(exigirChaveParceiro));

// GET /api/partner/events -> 200 [{id,name,startsAt,priceCents,availableSeats}].
// So eventos publicados e nao cancelados, com as vagas disponiveis (R05).
partnerRoutes.get(
  "/events",
  envolver(async (_req, res) => {
    const eventos = await eventoService.listarParaParceiros();
    res.status(200).json(eventos);
  }),
);

// POST /api/partner/events/:eventId/purchases com {buyerEmail, cardNumber} ->
// 202 {ticketId, code, status:"pending"}. Erros na ordem: corpo invalido (falta
// campo ou cartao != 16 digitos) -> 422; evento inexistente/rascunho/cancelado ->
// 404; sem vaga -> 409. Reusa comprar() SEM buyerUserId (caminho da API).
partnerRoutes.post(
  "/events/:eventId/purchases",
  envolver(async (req, res) => {
    const corpo = (req.body ?? {}) as { buyerEmail?: unknown; cardNumber?: unknown };
    if (
      typeof corpo.buyerEmail !== "string" ||
      corpo.buyerEmail.trim() === "" ||
      typeof corpo.cardNumber !== "string"
    ) {
      throw new ErroAplicacao("invalid_request", 422, "buyerEmail e cardNumber sao obrigatorios.");
    }
    // comprar() valida o cartao (422), confere o evento (404) e reserva a vaga
    // (409), nessa ordem; responde na hora com o ingresso pending (R06).
    const ingresso = await compras.comprar({
      eventId: req.params.eventId,
      buyerEmail: corpo.buyerEmail,
      cardNumber: corpo.cardNumber,
    });
    res.status(202).json({ ticketId: ingresso.id, code: ingresso.code, status: ingresso.status });
  }),
);

// GET /api/partner/tickets/:ticketId -> 200 {ticketId,code,eventId,status,checkedIn};
// inexistente -> 404 ticket_not_found.
partnerRoutes.get(
  "/tickets/:ticketId",
  envolver(async (req, res) => {
    const ingresso = await compras.obterIngressoParaParceiro(req.params.ticketId);
    res.status(200).json(ingresso);
  }),
);
