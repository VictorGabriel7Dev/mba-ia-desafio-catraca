// Aumento do Request do Express para carregar a sessão e a chave de parceiro
// resolvidas pelos middlewares. Mantém o acesso tipado nas rotas.
import type { ConteudoSessao } from "../lib/token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessao?: ConteudoSessao;
      parceiro?: { id: string; name: string };
    }
  }
}

export {};
