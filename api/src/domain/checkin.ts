// Regra pura do check-in (R10): dado o ingresso (ou a ausencia dele), o evento e
// o codigo pedido, decide a mensagem pela ORDEM fixada em docs/specs/_CONVENCOES.md
// (a primeira situacao verdadeira vence) e se o check-in deve ser marcado.
// Camada de dominio: nao importa infraestrutura (sem Prisma, sem Express, sem env).
import type { StatusEvento } from "./evento";
import type { StatusIngresso } from "./ingresso";

// Mensagens EXATAS de R10, na ordem de precedencia (a primeira verdadeira vence).
export type MensagemCheckin =
  | "Ingresso inválido para este evento"
  | "Evento cancelado"
  | "Ingresso não confirmado"
  | "Ingresso já utilizado"
  | "Entrada liberada";

// So os campos que a decisao precisa; o servico extrai isto do Ticket do Prisma.
export interface IngressoParaCheckin {
  code: string;
  eventId: string;
  status: StatusIngresso;
  checkedIn: boolean;
}

export interface EventoParaCheckin {
  id: string;
  status: StatusEvento;
}

export interface DecisaoCheckin {
  mensagem: MensagemCheckin;
  // So "Entrada liberada" manda marcar o check-in; as demais mensagens nao mudam nada.
  liberar: boolean;
}

// Decide a mensagem de check-in pela ordem de R10. `ingresso` e nulo quando o
// codigo nao existe no escopo do evento; a conferencia de eventId/codigo tambem
// trata, como defesa, o caso "de outro evento" caso o ingresso venha de fora.
export function decidirCheckin(
  ingresso: IngressoParaCheckin | null,
  evento: EventoParaCheckin,
  codigo: string,
): DecisaoCheckin {
  // 1. Codigo inexistente ou de outro evento.
  if (!ingresso || ingresso.eventId !== evento.id || ingresso.code !== codigo) {
    return { mensagem: "Ingresso inválido para este evento", liberar: false };
  }
  // 2. Evento cancelado vence sobre o estado do ingresso.
  if (evento.status === "cancelled") {
    return { mensagem: "Evento cancelado", liberar: false };
  }
  // 3. Ingresso que nao esta confirmado (pending, declined, cancelled, refunded).
  if (ingresso.status !== "confirmed") {
    return { mensagem: "Ingresso não confirmado", liberar: false };
  }
  // 4. Ingresso confirmado, porem ja utilizado.
  if (ingresso.checkedIn) {
    return { mensagem: "Ingresso já utilizado", liberar: false };
  }
  // 5. Confirmado e ainda nao usado: libera e manda marcar o check-in.
  return { mensagem: "Entrada liberada", liberar: true };
}
