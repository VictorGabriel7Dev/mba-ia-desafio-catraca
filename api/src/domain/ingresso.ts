// Regras puras do ingresso: status e rotulos, geracao de codigo unico, as
// transicoes condicionais pelo resultado do gateway e pelo cancelamento do
// evento, e o calculo de vagas disponiveis. Camada de dominio: nao importa
// infraestrutura (sem Prisma, sem Express, sem env). Ver docs/specs/_CONVENCOES.md.
import { randomUUID } from "node:crypto";

// Os mesmos valores do enum TicketStatus do schema (nao importa o Prisma aqui).
export type StatusIngresso = "pending" | "confirmed" | "declined" | "cancelled" | "refunded";

// Resultado que o gateway grava no Payment (enum PaymentOutcome do schema).
export type ResultadoGateway = "approved" | "declined";

// Rotulos em portugues para a exibicao (vitrine / "Meus ingressos").
export const ROTULOS_STATUS_INGRESSO: Record<StatusIngresso, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
};

export function rotuloStatusIngresso(status: StatusIngresso): string {
  return ROTULOS_STATUS_INGRESSO[status];
}

// Codigo unico usado no check-in (R09). A unicidade e garantida pelo UUID e,
// em ultima instancia, pela constraint unica da coluna `code` no banco.
export function gerarCodigoIngresso(): string {
  return `ING-${randomUUID()}`;
}

// Vaga ocupada = ingresso pending ou confirmed (R05).
export function ocupaVaga(status: StatusIngresso): boolean {
  return status === "pending" || status === "confirmed";
}

// Transicao pela resposta do gateway (R08). So faz sentido quando o ingresso
// ainda esta pending; a aplicacao e condicional a esse estado no repositorio.
// approved -> confirmed; declined -> declined (e a vaga volta a ficar livre,
// porque ocupadas conta apenas pending + confirmed).
export function statusAposGateway(outcome: ResultadoGateway): StatusIngresso {
  return outcome === "approved" ? "confirmed" : "declined";
}

// Transicoes do cancelamento do evento (R11), na ordem aplicada:
// confirmed -> refunded (estorno) e pending -> cancelled. Os demais status nao
// mudam. Fonte unica da regra, reusada por services/cancel-tickets.ts.
export function transicoesCancelamentoEvento(): Array<{ de: StatusIngresso; para: StatusIngresso }> {
  return [
    { de: "confirmed", para: "refunded" },
    { de: "pending", para: "cancelled" },
  ];
}

// Novo status de um ingresso individual quando o evento e cancelado; null quando
// o status nao transita. Equivale a tabela de transicoesCancelamentoEvento.
export function statusAposCancelamentoEvento(status: StatusIngresso): StatusIngresso | null {
  const transicao = transicoesCancelamentoEvento().find((t) => t.de === status);
  return transicao ? transicao.para : null;
}

// Vagas disponiveis: lotacao menos ocupadas; em evento cancelado, zero (R05).
// Nunca negativo.
export function vagasDisponiveis(
  capacidade: number,
  ocupadas: number,
  eventoCancelado: boolean,
): number {
  if (eventoCancelado) {
    return 0;
  }
  return Math.max(0, capacidade - ocupadas);
}
