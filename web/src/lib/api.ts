// Cliente HTTP do front. Fala com a API e envia o cookie de sessão (credentials).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface Usuario {
  id: string;
  name: string;
  email: string;
  role: "participant" | "organizer";
  createdAt: string;
}

export class ErroApi extends Error {
  constructor(public readonly codigo: string, public readonly status: number) {
    super(codigo);
  }
}

async function pedir<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) {
    const codigo = typeof corpo.error === "string" ? corpo.error : "erro_desconhecido";
    throw new ErroApi(codigo, resposta.status);
  }
  return corpo as T;
}

export function registrar(dados: { name: string; email: string; password: string }) {
  return pedir<{ user: Usuario }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function entrar(dados: { email: string; password: string }) {
  return pedir<{ user: Usuario }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function meuUsuario() {
  return pedir<{ user: Usuario }>("/api/auth/me");
}

export function sair() {
  return pedir<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}
