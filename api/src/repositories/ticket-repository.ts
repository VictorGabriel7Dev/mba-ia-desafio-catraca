// Acesso a Ticket (e ao Payment criado junto na compra) via Prisma. Unica porta
// do Prisma para ingressos; servicos e rotas nunca importam o Prisma direto.
//
// O ponto critico e a RESERVA ATOMICA de vaga (R07): inserir o ingresso pending
// so se `ocupadas < capacity`, numa transacao que TRAVA a linha do evento com
// `SELECT ... FOR UPDATE`. A trava por linha de evento serializa as compras
// concorrentes do MESMO evento, entao a contagem de ocupadas lida logo em
// seguida ja reflete as compras que commitaram antes. Sem a trava, duas compras
// simultaneas leriam a mesma contagem e ambas inseririam (overselling).
import type { Event, Ticket } from "@prisma/client";
import type { ResultadoGateway } from "../domain/ingresso";
import { prisma } from "../lib/prisma";

export interface DadosCompra {
  eventId: string;
  code: string;
  buyerEmail: string;
  buyerUserId: string | null;
  cardLast4: string;
  outcome: ResultadoGateway;
  resolveAt: Date;
}

// Uniao de resultado da reserva. A ordem de verificacao segue as convencoes:
// evento indisponivel (404) antes de sem vaga (409).
export type ResultadoReserva =
  | { resultado: "ok"; ticket: Ticket }
  | { resultado: "event_not_available" }
  | { resultado: "sold_out" };

interface LinhaEvento {
  capacity: number;
  priceCents: number;
  status: string;
}

export async function criarCompraAtomica(dados: DadosCompra): Promise<ResultadoReserva> {
  return prisma.$transaction(async (tx): Promise<ResultadoReserva> => {
    // Trava a linha do evento ate o fim da transacao. Compras concorrentes do
    // mesmo evento esperam aqui e so entao contam as ocupadas.
    const linhas = await tx.$queryRaw<LinhaEvento[]>`
      SELECT capacity, "priceCents", status FROM "Event" WHERE id = ${dados.eventId} FOR UPDATE
    `;
    const evento = linhas[0];
    // Reconfere dentro da trava: so evento publicado aceita compra (um cancelamento
    // concorrente nao deixa vaga nascer). Evita corrida entre compra e cancelamento.
    if (!evento || evento.status !== "published") {
      return { resultado: "event_not_available" };
    }

    const ocupadas = await tx.ticket.count({
      where: { eventId: dados.eventId, status: { in: ["pending", "confirmed"] } },
    });
    if (ocupadas >= evento.capacity) {
      return { resultado: "sold_out" };
    }

    // Insere o ingresso pending e o Payment (outcome/resolveAt ja decididos) na
    // mesma transacao; o preco pago e o snapshot do preco vigente do evento (R03).
    const ticket = await tx.ticket.create({
      data: {
        eventId: dados.eventId,
        code: dados.code,
        buyerEmail: dados.buyerEmail,
        buyerUserId: dados.buyerUserId,
        status: "pending",
        pricePaidCents: evento.priceCents,
        payment: {
          create: {
            cardLast4: dados.cardLast4,
            outcome: dados.outcome,
            resolveAt: dados.resolveAt,
          },
        },
      },
    });
    return { resultado: "ok", ticket };
  });
}

// Busca um ingresso por id (consulta da API de parceiros, F6). Traz todas as
// colunas do Ticket, inclusive `checkedIn`. Nulo quando nao existe.
export async function buscarPorId(id: string): Promise<Ticket | null> {
  return prisma.ticket.findUnique({ where: { id } });
}

// "Meus ingressos" do participante: ingressos vinculados a conta dele, com o
// evento embutido para exibir nome/estado.
export type IngressoComEvento = Ticket & { event: Event };

export async function listarPorComprador(userId: string): Promise<IngressoComEvento[]> {
  return prisma.ticket.findMany({
    where: { buyerUserId: userId },
    orderBy: { createdAt: "desc" },
    include: { event: true },
  });
}
