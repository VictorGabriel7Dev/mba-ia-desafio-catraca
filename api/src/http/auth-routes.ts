// Rotas de conta e sessão: register, login, me, logout.
import { Router } from "express";
import type { CookieOptions } from "express";
import * as auth from "../services/auth-service";
import { env } from "../config/env";
import { exigirSessao, NOME_COOKIE_SESSAO } from "./middlewares/exigir-sessao";
import { envolver } from "./async";
import "./context";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function opcoesCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SETE_DIAS_MS,
  };
}

export const authRoutes = Router();

authRoutes.post(
  "/register",
  envolver(async (req, res) => {
    const { usuario, token } = await auth.registrarParticipante(req.body ?? {});
    res.cookie(NOME_COOKIE_SESSAO, token, opcoesCookie());
    res.status(201).json({ user: usuario, token });
  }),
);

authRoutes.post(
  "/login",
  envolver(async (req, res) => {
    const { usuario, token } = await auth.login(req.body ?? {});
    res.cookie(NOME_COOKIE_SESSAO, token, opcoesCookie());
    res.status(200).json({ user: usuario, token });
  }),
);

authRoutes.get(
  "/me",
  exigirSessao,
  envolver(async (req, res) => {
    const usuario = await auth.me(req.sessao!.sub);
    res.status(200).json({ user: usuario });
  }),
);

authRoutes.post("/logout", (_req, res) => {
  res.clearCookie(NOME_COOKIE_SESSAO, { path: "/" });
  res.status(200).json({ ok: true });
});
