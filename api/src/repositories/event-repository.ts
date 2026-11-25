// Acesso a Event (e a contagem de ingressos ocupados por evento) via Prisma.
// Unica porta de leitura/escrita de eventos; servicos e rotas nunca importam o
// Prisma direto. A contagem de ocupadas e a transicao em lote no cancelamento
// vivem aqui porque F3 e F5 reaproveitam a mesma porta.
import type { Event } from "@prisma/client";
import type { StatusIngresso } from "../domain/ingresso";
import { prisma } from "../lib/prisma";

export interface NovoEvento {
  organizerId: string;
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export interface AtualizacaoEvento {
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export async function criar(dados: NovoEvento): Promise<Event> {
  // status nasce "draft" pelo default do schema (R02).
  return prisma.event.create({ data: dados });
}

export async function buscarPorId(id: string): Promise<Event | null> {
  return prisma.event.findUnique({ where: { id } });
}

export async function atualizar(id: string, dados: AtualizacaoEvento): Promise<Event> {
  return prisma.event.update({ where: { id }, data: dados });
}

export async function atualizarStatus(
  id: string,
  status: "published" | "cancelled",
): Promise<Event> {
  return prisma.event.update({ where: { id }, data: { status } });
}

// Vitrine/API: so eventos publicados (e nao cancelados), mais proximos primeiro.
export async function listarPublicados(): Promise<Event[]> {
  return prisma.event.findMany({
    where: { status: "published" },
    orderBy: { startsAt: "asc" },
  });
}

// Area do organizador: todos os eventos do dono, mais recentes primeiro.
export async function listarPorOrganizador(organizerId: string): Promise<Event[]> {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { createdAt: "desc" },
  });
}

// Vaga ocupada = ingresso pending ou confirmed (R05). Reaproveitada por F3 e F5.
export async function contarOcupadas(eventId: string): Promise<number> {
  return prisma.ticket.count({
    where: { eventId, status: { in: ["pending", "confirmed"] } },
  });
}

// Cancelamento atomico (R11): marca o evento como cancelled e, na mesma
// transacao, aplica as transicoes de ingresso recebidas. A REGRA das transicoes
// (confirmed -> refunded, pending -> cancelled) mora no dominio
// (domain/ingresso.ts) e e consolidada em services/cancel-tickets.ts; aqui so
// se executa a aplicacao atomica, na ordem recebida.
export async function cancelarEventoETransitarIngressos(
  eventId: string,
  transicoes: Array<{ de: StatusIngresso; para: StatusIngresso }>,
): Promise<void> {
  await prisma.$transaction([
    prisma.event.update({ where: { id: eventId }, data: { status: "cancelled" } }),
    ...transicoes.map(({ de, para }) =>
      prisma.ticket.updateMany({
        where: { eventId, status: de },
        data: { status: para },
      }),
    ),
  ]);
}
