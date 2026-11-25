// Compra, vagas e pagamento (F3). Orquestra o dominio (ingresso, gateway-sim) e
// os repositorios; nunca toca em Prisma nem em Express. A compra nasce pending,
// ja ocupa vaga e responde na hora (R06), sem esperar o gateway; o worker resolve
// o Payment quando o resolveAt vencer. Codigos de erro em docs/specs/_CONVENCOES.md.
import type { Ticket } from "@prisma/client";
import { cartaoTem16Digitos, decidirPagamento, ultimos4 } from "../domain/gateway-sim";
import {
  gerarCodigoIngresso,
  rotuloStatusIngresso,
  vagasDisponiveis,
  type StatusIngresso,
} from "../domain/ingresso";
import { ErroAplicacao } from "../lib/errors";
import * as eventos from "../repositories/event-repository";
import * as ingressos from "../repositories/ticket-repository";
import * as usuarios from "../repositories/user-repository";

export interface IngressoPublico {
  id: string;
  eventId: string;
  code: string;
  status: StatusIngresso;
  buyerEmail: string;
  buyerUserId: string | null;
  pricePaidCents: number;
  createdAt: string;
}

export interface IngressoComEvento extends IngressoPublico {
  statusLabel: string;
  evento: {
    id: string;
    name: string;
    startsAt: string;
    location: string;
    status: "draft" | "published" | "cancelled";
  };
}

export interface EntradaCompra {
  eventId: string;
  buyerEmail: string;
  cardNumber: string;
  // Nulo/ausente quando a compra vem da API de parceiros (sem conta vinculada).
  buyerUserId?: string | null;
}

export function paraPublico(ticket: Ticket): IngressoPublico {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    code: ticket.code,
    status: ticket.status,
    buyerEmail: ticket.buyerEmail,
    buyerUserId: ticket.buyerUserId,
    pricePaidCents: ticket.pricePaidCents,
    createdAt: ticket.createdAt.toISOString(),
  };
}

// Compra de ingresso. `agora` e injetavel para testes; em producao e o instante
// real. Ordem de verificacao (convencoes): 422 (cartao) -> 404 (evento) -> 409
// (sem vaga). A 401 e tratada antes, no middleware da rota.
export async function comprar(entrada: EntradaCompra, agora: Date = new Date()): Promise<IngressoPublico> {
  const { eventId, buyerEmail, cardNumber } = entrada;
  const buyerUserId = entrada.buyerUserId ?? null;

  // Cartao fora de 16 digitos: rejeita ANTES de criar o ingresso.
  if (!cartaoTem16Digitos(cardNumber)) {
    throw new ErroAplicacao("invalid_request", 422, "Cartao deve ter 16 digitos.");
  }

  // Decide outcome e resolveAt na hora da compra; o worker so observa o relogio.
  const { outcome, resolveAt } = decidirPagamento(cardNumber, agora);

  const resultado = await ingressos.criarCompraAtomica({
    eventId,
    code: gerarCodigoIngresso(),
    buyerEmail,
    buyerUserId,
    cardLast4: ultimos4(cardNumber),
    outcome,
    resolveAt,
  });

  if (resultado.resultado === "event_not_available") {
    throw new ErroAplicacao("event_not_available", 404, "Evento indisponivel para compra.");
  }
  if (resultado.resultado === "sold_out") {
    throw new ErroAplicacao("sold_out", 409, "Ingressos esgotados.");
  }
  return paraPublico(resultado.ticket);
}

// Compra pela vitrine: o participante logado e o comprador (buyerEmail e o e-mail
// dele; buyerUserId vincula a conta). Deixa comprar() pronto para a API de
// parceiros (F6), que chama sem buyerUserId.
export async function comprarComoParticipante(
  eventId: string,
  userId: string,
  cardNumber: string,
  agora: Date = new Date(),
): Promise<IngressoPublico> {
  const usuario = await usuarios.buscarPorId(userId);
  if (!usuario) {
    throw new ErroAplicacao("unauthorized", 401, "Sessao invalida.");
  }
  return comprar({ eventId, buyerEmail: usuario.email, cardNumber, buyerUserId: usuario.id }, agora);
}

// "Meus ingressos" do participante: evento, status e codigo.
export async function listarIngressosDoParticipante(userId: string): Promise<IngressoComEvento[]> {
  const lista = await ingressos.listarPorComprador(userId);
  return lista.map((ticket) => ({
    ...paraPublico(ticket),
    statusLabel: rotuloStatusIngresso(ticket.status),
    evento: {
      id: ticket.event.id,
      name: ticket.event.name,
      startsAt: ticket.event.startsAt.toISOString(),
      location: ticket.event.location,
      status: ticket.event.status,
    },
  }));
}

export interface Disponibilidade {
  capacity: number;
  ocupadas: number;
  disponiveis: number;
}

// Vagas de um evento (R05): ocupadas = pending + confirmed; disponiveis = lotacao
// menos ocupadas; em evento cancelado, disponiveis = 0.
export async function disponibilidade(eventId: string): Promise<Disponibilidade> {
  const evento = await eventos.buscarPorId(eventId);
  if (!evento) {
    throw new ErroAplicacao("event_not_found", 404, "Evento nao encontrado.");
  }
  const ocupadas = await eventos.contarOcupadas(eventId);
  return {
    capacity: evento.capacity,
    ocupadas,
    disponiveis: vagasDisponiveis(evento.capacity, ocupadas, evento.status === "cancelled"),
  };
}
