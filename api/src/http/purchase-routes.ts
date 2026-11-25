// Compra pela vitrine (F3): POST /api/events/:id/purchases. Exige sessao; o
// comprador e o usuario logado (buyerEmail = e-mail dele, buyerUserId = id dele).
// Corpo: { cardNumber }. Montado em /api/events ao lado da vitrine publica.
import { Router } from "express";
import * as compras from "../services/purchase-service";
import { exigirSessao } from "./middlewares/exigir-sessao";
import { envolver } from "./async";
import { ErroAplicacao } from "../lib/errors";
import "./context";

export const purchaseRoutes = Router();

purchaseRoutes.post(
  "/:id/purchases",
  exigirSessao,
  envolver(async (req, res) => {
    const corpo = (req.body ?? {}) as { cardNumber?: unknown };
    if (typeof corpo.cardNumber !== "string") {
      throw new ErroAplicacao("invalid_request", 422, "cardNumber e obrigatorio.");
    }
    const ingresso = await compras.comprarComoParticipante(
      req.params.id,
      req.sessao!.sub,
      corpo.cardNumber,
    );
    res.status(201).json(ingresso);
  }),
);
