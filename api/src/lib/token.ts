// Assinatura e verificação do token de sessão (JWT).
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface ConteudoSessao {
  sub: string;
  role: "participant" | "organizer";
}

const VALIDADE = "7d";

export function assinarSessao(conteudo: ConteudoSessao): string {
  return jwt.sign(conteudo, env.JWT_SECRET, { expiresIn: VALIDADE });
}

export function verificarSessao(token: string): ConteudoSessao | null {
  try {
    const dados = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof dados === "object" &&
      dados !== null &&
      typeof dados.sub === "string" &&
      (dados.role === "participant" || dados.role === "organizer")
    ) {
      return { sub: dados.sub, role: dados.role };
    }
    return null;
  } catch {
    return null;
  }
}
