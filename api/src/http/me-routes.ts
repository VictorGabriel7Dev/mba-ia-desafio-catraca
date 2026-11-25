// Area do participante logado (F3): "Meus ingressos". Exige sessao. Lista os
// ingressos vinculados a conta, com evento, status e codigo.
import { Router } from "express";
import * as compras from "../services/purchase-service";
import { exigirSessao } from "./middlewares/exigir-sessao";
import { envolver } from "./async";
import "./context";

export const meRoutes = Router();

meRoutes.use(exigirSessao);

meRoutes.get(
  "/tickets",
  envolver(async (req, res) => {
    const lista = await compras.listarIngressosDoParticipante(req.sessao!.sub);
    res.status(200).json(lista);
  }),
);
