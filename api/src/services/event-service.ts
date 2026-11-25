// Regras de evento: criar, editar, publicar, cancelar e as listagens.
// Orquestra o dominio (evento.ts) e o repositorio; nunca toca em Prisma nem em
// Express. Os codigos de erro seguem docs/specs/_CONVENCOES.md.
import type { Event } from "@prisma/client";
import {
  capacidadeComportaOcupadas,
  capacidadeValida,
  dataValidaEFutura,
  localValido,
  nomeEventoValido,
  podeCancelar,
  podeEditar,
  podePublicar,
  precoValido,
  type StatusEvento,
} from "../domain/evento";
import { ErroAplicacao } from "../lib/errors";
import * as eventos from "../repositories/event-repository";

export interface EventoPublico {
  id: string;
  organizerId: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: StatusEvento;
  createdAt: string;
  updatedAt: string;
}

export interface EntradaEvento {
  name?: unknown;
  startsAt?: unknown;
  location?: unknown;
  capacity?: unknown;
  priceCents?: unknown;
}

interface DadosValidados {
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export function paraPublico(evento: Event): EventoPublico {
  return {
    id: evento.id,
    organizerId: evento.organizerId,
    name: evento.name,
    startsAt: evento.startsAt.toISOString(),
    location: evento.location,
    capacity: evento.capacity,
    priceCents: evento.priceCents,
    status: evento.status,
    createdAt: evento.createdAt.toISOString(),
    updatedAt: evento.updatedAt.toISOString(),
  };
}

// Valida os invariantes de dados do evento (R01), iguais na criacao e na edicao.
function validarDados(entrada: EntradaEvento): DadosValidados {
  if (!nomeEventoValido(entrada.name)) {
    throw new ErroAplicacao("invalid_request", 422, "Nome do evento invalido.");
  }
  if (!localValido(entrada.location)) {
    throw new ErroAplicacao("invalid_request", 422, "Local do evento invalido.");
  }
  if (!capacidadeValida(entrada.capacity)) {
    throw new ErroAplicacao("invalid_request", 422, "Lotacao deve ser inteira e no minimo 1.");
  }
  if (!precoValido(entrada.priceCents)) {
    throw new ErroAplicacao("invalid_request", 422, "Preco deve ser inteiro e maior que zero.");
  }
  if (typeof entrada.startsAt !== "string" && !(entrada.startsAt instanceof Date)) {
    throw new ErroAplicacao("invalid_request", 422, "Data de inicio invalida.");
  }
  const startsAt = new Date(entrada.startsAt as string | Date);
  if (!dataValidaEFutura(startsAt, new Date())) {
    throw new ErroAplicacao("invalid_request", 422, "A data de inicio deve ser no futuro.");
  }
  return {
    name: (entrada.name as string).trim(),
    startsAt,
    location: (entrada.location as string).trim(),
    capacity: entrada.capacity as number,
    priceCents: entrada.priceCents as number,
  };
}

// Carrega um evento garantindo que o solicitante e o dono (R13). Evento
// inexistente => 404; evento de outro organizador => 403.
async function carregarDoDono(eventId: string, organizerId: string): Promise<Event> {
  const evento = await eventos.buscarPorId(eventId);
  if (!evento) {
    throw new ErroAplicacao("event_not_found", 404, "Evento nao encontrado.");
  }
  if (evento.organizerId !== organizerId) {
    throw new ErroAplicacao("forbidden", 403, "Este evento pertence a outro organizador.");
  }
  return evento;
}

export async function criar(organizerId: string, entrada: EntradaEvento): Promise<EventoPublico> {
  const dados = validarDados(entrada);
  const criado = await eventos.criar({ organizerId, ...dados });
  return paraPublico(criado);
}

export async function editar(
  eventId: string,
  organizerId: string,
  entrada: EntradaEvento,
): Promise<EventoPublico> {
  const evento = await carregarDoDono(eventId, organizerId);
  if (!podeEditar(evento.status)) {
    throw new ErroAplicacao("invalid_state", 409, "Evento cancelado nao pode ser editado.");
  }
  const dados = validarDados(entrada);
  // A lotacao nunca pode cair abaixo das vagas ja ocupadas (R05); aumentar pode.
  const ocupadas = await eventos.contarOcupadas(eventId);
  if (!capacidadeComportaOcupadas(dados.capacity, ocupadas)) {
    throw new ErroAplicacao(
      "capacity_below_occupied",
      409,
      `A lotacao nao pode ser menor que as ${ocupadas} vagas ocupadas.`,
    );
  }
  const atualizado = await eventos.atualizar(eventId, dados);
  return paraPublico(atualizado);
}

export async function publicar(eventId: string, organizerId: string): Promise<EventoPublico> {
  const evento = await carregarDoDono(eventId, organizerId);
  if (!podePublicar(evento.status)) {
    throw new ErroAplicacao("invalid_state", 409, "So um rascunho pode ser publicado.");
  }
  const atualizado = await eventos.atualizarStatus(eventId, "published");
  return paraPublico(atualizado);
}

export async function cancelar(eventId: string, organizerId: string): Promise<EventoPublico> {
  const evento = await carregarDoDono(eventId, organizerId);
  if (!podeCancelar(evento.status)) {
    throw new ErroAplicacao("invalid_state", 409, "Evento ja cancelado.");
  }
  // Marca cancelado e transita os ingressos (R11) numa unica transacao.
  await eventos.cancelarComIngressos(eventId);
  const atualizado = await eventos.buscarPorId(eventId);
  // Nao e nulo: acabamos de atualizar dentro da transacao.
  return paraPublico(atualizado as Event);
}

// Vitrine publica: so eventos publicados e nao cancelados (R02).
export async function listarVitrine(): Promise<EventoPublico[]> {
  const lista = await eventos.listarPublicados();
  return lista.map(paraPublico);
}

// Detalhe publico: so um evento publicado pode ser visto por visitante.
export async function obterPublicado(eventId: string): Promise<EventoPublico> {
  const evento = await eventos.buscarPorId(eventId);
  if (!evento || evento.status !== "published") {
    throw new ErroAplicacao("event_not_available", 404, "Evento indisponivel.");
  }
  return paraPublico(evento);
}

export async function listarDoOrganizador(organizerId: string): Promise<EventoPublico[]> {
  const lista = await eventos.listarPorOrganizador(organizerId);
  return lista.map(paraPublico);
}

// Pagina de gestao por URL propria (R04), restrita ao dono (R13).
export async function obterParaGestao(
  eventId: string,
  organizerId: string,
): Promise<EventoPublico> {
  const evento = await carregarDoDono(eventId, organizerId);
  return paraPublico(evento);
}
