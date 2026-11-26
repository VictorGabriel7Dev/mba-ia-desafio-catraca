// Painel do evento (F5, R12): os seis numeros que a pagina de gestao mostra.
// Orquestra o dominio (vagas disponiveis) e os repositorios (agregados de
// ingresso e o evento); nunca toca em Prisma nem em Express. So leitura sobre
// Ticket (F3) e Event (F2). Codigos de erro em docs/specs/_CONVENCOES.md.
import { vagasDisponiveis, type StatusIngresso } from "../domain/ingresso";
import { ErroAplicacao } from "../lib/errors";
import * as eventos from "../repositories/event-repository";
import * as ingressos from "../repositories/ticket-repository";

export interface PainelEvento {
  // Ingressos confirmados (inclusive os que ja fizeram check-in).
  confirmados: number;
  // Ingressos pendentes (aguardando o gateway).
  pendentes: number;
  // Confirmados que ja entraram (checkedIn = true).
  checkins: number;
  // Lotacao menos ocupadas (pending + confirmed); zero em evento cancelado (R05).
  vagasDisponiveis: number;
  // Soma de pricePaidCents dos confirmados: o preco vigente em cada compra (R03).
  receitaCents: number;
  // Ingressos estornados (estavam confirmados quando o evento foi cancelado).
  estornados: number;
}

// Calcula o painel do evento. Valida que o solicitante e o dono (R13): evento
// inexistente => 404; evento de outro organizador => 403. As contagens saem de
// uma consulta agregada por status (groupBy) mais a soma da receita e os
// check-ins; ocupadas = pending + confirmed vem dos proprios grupos.
export async function painelDoEvento(
  eventId: string,
  organizerId: string,
): Promise<PainelEvento> {
  const evento = await eventos.buscarPorId(eventId);
  if (!evento) {
    throw new ErroAplicacao("event_not_found", 404, "Evento nao encontrado.");
  }
  if (evento.organizerId !== organizerId) {
    throw new ErroAplicacao("forbidden", 403, "Este evento pertence a outro organizador.");
  }

  const contagens = await ingressos.contarPorStatus(eventId);
  const porStatus = new Map<StatusIngresso, number>(
    contagens.map((c) => [c.status, c.total]),
  );
  const total = (status: StatusIngresso): number => porStatus.get(status) ?? 0;

  const confirmados = total("confirmed");
  const pendentes = total("pending");
  const estornados = total("refunded");
  // Ocupada = pending + confirmed (R05); nao precisa de outra consulta.
  const ocupadas = confirmados + pendentes;

  const checkins = await ingressos.contarCheckins(eventId);
  const receitaCents = await ingressos.somarReceitaConfirmados(eventId);

  return {
    confirmados,
    pendentes,
    checkins,
    vagasDisponiveis: vagasDisponiveis(evento.capacity, ocupadas, evento.status === "cancelled"),
    receitaCents,
    estornados,
  };
}
