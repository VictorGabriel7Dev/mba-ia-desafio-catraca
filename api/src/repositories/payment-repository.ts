// Acesso a Payment via Prisma. Unica porta do Prisma para pagamentos. O worker
// usa estas funcoes para resolver os pagamentos cujo resolveAt ja venceu.
import type { ResultadoGateway, StatusIngresso } from "../domain/ingresso";
import { prisma } from "../lib/prisma";

export interface PagamentoVencido {
  id: string;
  ticketId: string;
  outcome: ResultadoGateway;
}

// Pagamentos a processar: resolveAt no passado (<= agora), ainda nao processados
// e cujo ingresso continua pending. O filtro por ticket pending ja exclui os
// ingressos cancelados pelo cancelamento do evento (R08/R11): a resposta tardia
// do gateway nao mexe neles.
export async function listarVencidosNaoProcessados(agora: Date): Promise<PagamentoVencido[]> {
  return prisma.payment.findMany({
    where: {
      resolveAt: { lte: agora },
      processedAt: null,
      ticket: { status: "pending" },
    },
    select: { id: true, ticketId: true, outcome: true },
  });
}

// Aplica a resolucao de um pagamento numa transacao: transita o ingresso de
// forma CONDICIONAL (so se ainda pending) e marca o Payment como processado.
// Mesmo que o ingresso ja tenha saido de pending (cancelamento), o Payment e
// marcado para nao ser reprocessado.
export async function aplicarResolucao(
  paymentId: string,
  ticketId: string,
  novoStatus: StatusIngresso,
  agora: Date,
): Promise<void> {
  await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { id: ticketId, status: "pending" },
      data: { status: novoStatus },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { processedAt: agora },
    }),
  ]);
}
