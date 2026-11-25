// Check-in (F4). Orquestra o dominio (domain/checkin) e os repositorios; nunca
// toca em Prisma nem em Express. O dono do evento e verificado pela logica de F2
// (R13); so entao o ingresso e buscado NO ESCOPO do evento e a decisao pura de
// R10 define a mensagem. Quando "Entrada liberada", marca o check-in de forma
// condicional (so se ainda nao usado). Mensagens em docs/specs/_CONVENCOES.md.
import {
  decidirCheckin,
  type IngressoParaCheckin,
  type MensagemCheckin,
} from "../domain/checkin";
import * as eventos from "../services/event-service";
import * as ingressos from "../repositories/ticket-repository";

export interface ResultadoCheckin {
  mensagem: MensagemCheckin;
  codigo: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

// Faz o check-in de um ingresso pelo codigo, no escopo de um evento do dono.
// `agora` e injetavel para testes; em producao e o instante real. A verificacao
// de dono (obterParaGestao, F2) lanca 404 (evento inexistente) ou 403 (de outro
// organizador) ANTES de qualquer leitura de ingresso (R13).
export async function fazerCheckin(
  eventId: string,
  organizerId: string,
  codigo: string,
  agora: Date = new Date(),
): Promise<ResultadoCheckin> {
  // R13: so o dono do evento opera. Reusa a logica de F2.
  const evento = await eventos.obterParaGestao(eventId, organizerId);

  const codigoBusca = codigo.trim();
  const ticket = await ingressos.buscarPorCodigoNoEvento(eventId, codigoBusca);

  const ingressoParaDecisao: IngressoParaCheckin | null = ticket
    ? {
        code: ticket.code,
        eventId: ticket.eventId,
        status: ticket.status,
        checkedIn: ticket.checkedIn,
      }
    : null;

  const decisao = decidirCheckin(
    ingressoParaDecisao,
    { id: evento.id, status: evento.status },
    codigoBusca,
  );

  if (decisao.liberar && ticket) {
    // Transicao condicional: so marca se ainda nao usado. Se outra catraca marcou
    // primeiro (corrida), o ingresso ja foi utilizado.
    const marcou = await ingressos.marcarCheckinSeNaoUsado(ticket.id, agora);
    if (!marcou) {
      return {
        mensagem: "Ingresso já utilizado",
        codigo: codigoBusca,
        checkedIn: true,
        checkedInAt: null,
      };
    }
    return {
      mensagem: "Entrada liberada",
      codigo: codigoBusca,
      checkedIn: true,
      checkedInAt: agora.toISOString(),
    };
  }

  return {
    mensagem: decisao.mensagem,
    codigo: codigoBusca,
    checkedIn: ticket?.checkedIn ?? false,
    checkedInAt: ticket?.checkedInAt ? ticket.checkedInAt.toISOString() : null,
  };
}
