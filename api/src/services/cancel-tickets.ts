// Consolidacao pedida pela spec da F3: a transicao em lote dos ingressos quando o
// evento e cancelado (R11) passa a ter um ponto unico de servico. A REGRA
// (confirmed -> refunded, pending -> cancelled) mora no dominio
// (domain/ingresso.ts, transicoesCancelamentoEvento); aqui so se orquestra a
// aplicacao atomica no repositorio. O comportamento e identico ao que vivia em
// event-repository, para nao quebrar F2. Reaproveitavel por quem precise cancelar
// um evento transitando seus ingressos.
import { transicoesCancelamentoEvento } from "../domain/ingresso";
import * as eventos from "../repositories/event-repository";

export async function cancelarEventoComIngressos(eventId: string): Promise<void> {
  await eventos.cancelarEventoETransitarIngressos(eventId, transicoesCancelamentoEvento());
}
