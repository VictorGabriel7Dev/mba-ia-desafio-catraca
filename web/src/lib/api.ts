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

export interface Evento {
  id: string;
  organizerId: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: "draft" | "published" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface DadosEvento {
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
}

// Vitrine publica (sem sessao).
export function listarVitrine() {
  return pedir<Evento[]>("/api/events");
}

export function obterEventoPublico(id: string) {
  return pedir<Evento>(`/api/events/${id}`);
}

// Area do organizador (exige sessao de organizador).
export function listarMeusEventos() {
  return pedir<Evento[]>("/api/organizer/events");
}

export function obterEventoGestao(id: string) {
  return pedir<Evento>(`/api/organizer/events/${id}`);
}

export function criarEvento(dados: DadosEvento) {
  return pedir<Evento>("/api/organizer/events", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function editarEvento(id: string, dados: DadosEvento) {
  return pedir<Evento>(`/api/organizer/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export function publicarEvento(id: string) {
  return pedir<Evento>(`/api/organizer/events/${id}/publish`, { method: "POST" });
}

export function cancelarEvento(id: string) {
  return pedir<Evento>(`/api/organizer/events/${id}/cancel`, { method: "POST" });
}

export type StatusIngresso = "pending" | "confirmed" | "declined" | "cancelled" | "refunded";

export interface Ingresso {
  id: string;
  eventId: string;
  code: string;
  status: StatusIngresso;
  buyerEmail: string;
  buyerUserId: string | null;
  pricePaidCents: number;
  createdAt: string;
}

export interface IngressoComEvento extends Ingresso {
  statusLabel: string;
  evento: {
    id: string;
    name: string;
    startsAt: string;
    location: string;
    status: "draft" | "published" | "cancelled";
  };
}

// Compra pela vitrine (exige sessao). O comprador e o usuario logado.
export function comprarIngresso(eventoId: string, cardNumber: string) {
  return pedir<Ingresso>(`/api/events/${eventoId}/purchases`, {
    method: "POST",
    body: JSON.stringify({ cardNumber }),
  });
}

// "Meus ingressos" do participante logado.
export function meusIngressos() {
  return pedir<IngressoComEvento[]>("/api/me/tickets");
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
