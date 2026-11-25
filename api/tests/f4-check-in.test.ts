// Testes de contrato da F4 (C-F4-01 a C-F4-04): check-in e a ordem de R10.
// Cobre a funcao pura de decisao, o servico (que marca o check-in condicional) e
// a rota do organizador. Reusa as fixtures de F1/F2 e o fluxo real de F2/F3.
import { describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/http/app";
import { decidirCheckin } from "../src/domain/checkin";
import * as eventoService from "../src/services/event-service";
import * as checkinService from "../src/services/checkin-service";
import { criarOrganizador, criarTicket } from "./fixtures";

const app = criarApp();

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

let contadorOrg = 0;

function dadosEvento(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Mostra de Teatro",
    startsAt: new Date(Date.now() + UMA_SEMANA_MS).toISOString(),
    location: "Sala Preta",
    capacity: 50,
    priceCents: 4000,
    ...overrides,
  };
}

// Cria um organizador e um evento JA PUBLICADO pelo fluxo real do servico (F2).
async function criarEventoPublicado(): Promise<{ eventId: string; organizerId: string }> {
  contadorOrg += 1;
  const { user } = await criarOrganizador(`orgf4-${contadorOrg}@teste.dev`);
  const evento = await eventoService.criar(user.id, dadosEvento());
  await eventoService.publicar(evento.id, user.id);
  return { eventId: evento.id, organizerId: user.id };
}

describe("C-F4-01 codigo inexistente ou de outro evento", () => {
  it("decisao pura: ingresso ausente ou de outro evento -> Ingresso invalido para este evento", () => {
    const evento = { id: "ev1", status: "published" as const };

    // Ausente (codigo inexistente).
    expect(decidirCheckin(null, evento, "NAO-EXISTE")).toEqual({
      mensagem: "Ingresso inválido para este evento",
      liberar: false,
    });

    // De outro evento (eventId diferente).
    const deOutro = {
      code: "ING-1",
      eventId: "ev2",
      status: "confirmed" as const,
      checkedIn: false,
    };
    expect(decidirCheckin(deOutro, evento, "ING-1")).toEqual({
      mensagem: "Ingresso inválido para este evento",
      liberar: false,
    });
  });

  it("servico e rota: codigo inexistente no evento -> mensagem de invalido", async () => {
    const { eventId, organizerId } = await criarEventoPublicado();

    const resultado = await checkinService.fazerCheckin(eventId, organizerId, "NAO-EXISTE");
    expect(resultado.mensagem).toBe("Ingresso inválido para este evento");

    // Rota: o dono logado tenta um codigo que nao existe.
    const login = await request(app).post("/api/auth/login").send({
      email: `orgf4-${contadorOrg}@teste.dev`,
      password: "organizador123",
    });
    const token = login.body.token as string;
    const resposta = await request(app)
      .post(`/api/organizer/events/${eventId}/checkin`)
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "NAO-EXISTE" });
    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toBe("Ingresso inválido para este evento");
  });

  it("servico: ingresso de OUTRO evento nao casa no escopo -> invalido", async () => {
    const alvo = await criarEventoPublicado();
    const outro = await criarEventoPublicado();
    const ticketOutro = await criarTicket(outro.eventId, "confirmed");

    // O codigo existe, mas pertence a outro evento: invalido no escopo do alvo.
    const resultado = await checkinService.fazerCheckin(
      alvo.eventId,
      alvo.organizerId,
      ticketOutro.code,
    );
    expect(resultado.mensagem).toBe("Ingresso inválido para este evento");
  });
});

describe("C-F4-02 evento cancelado vence sobre o status do ingresso", () => {
  it("evento cancelado com ingresso confirmado -> Evento cancelado", async () => {
    const { eventId, organizerId } = await criarEventoPublicado();
    await criarTicket(eventId, "confirmed");
    const ticket = await criarTicket(eventId, "confirmed");

    // Cancela o evento pelo fluxo real de F2.
    await eventoService.cancelar(eventId, organizerId);

    const resultado = await checkinService.fazerCheckin(eventId, organizerId, ticket.code);
    expect(resultado.mensagem).toBe("Evento cancelado");

    // Decisao pura: cancelado vence mesmo com ingresso confirmado e nao usado.
    expect(
      decidirCheckin(
        { code: "X", eventId: "e", status: "confirmed", checkedIn: false },
        { id: "e", status: "cancelled" },
        "X",
      ).mensagem,
    ).toBe("Evento cancelado");
  });
});

describe("C-F4-03 ingresso pendente nao libera", () => {
  it("ingresso pending -> Ingresso nao confirmado", async () => {
    const { eventId, organizerId } = await criarEventoPublicado();
    const ticket = await criarTicket(eventId, "pending");

    const resultado = await checkinService.fazerCheckin(eventId, organizerId, ticket.code);
    expect(resultado.mensagem).toBe("Ingresso não confirmado");
  });
});

describe("C-F4-04 confirmado libera e marca; segundo check-in acusa ja utilizado", () => {
  it("primeiro check-in libera e marca checkedIn; segundo retorna ja utilizado", async () => {
    const { eventId, organizerId } = await criarEventoPublicado();
    const ticket = await criarTicket(eventId, "confirmed");

    // Primeiro check-in: libera a entrada e marca o ingresso.
    const primeiro = await checkinService.fazerCheckin(eventId, organizerId, ticket.code);
    expect(primeiro.mensagem).toBe("Entrada liberada");
    expect(primeiro.checkedIn).toBe(true);
    expect(primeiro.checkedInAt).not.toBeNull();

    // Segundo check-in do mesmo codigo: ja utilizado.
    const segundo = await checkinService.fazerCheckin(eventId, organizerId, ticket.code);
    expect(segundo.mensagem).toBe("Ingresso já utilizado");

    // Pela rota do dono, o mesmo codigo ja usado acusa ja utilizado.
    const login = await request(app).post("/api/auth/login").send({
      email: `orgf4-${contadorOrg}@teste.dev`,
      password: "organizador123",
    });
    const token = login.body.token as string;
    const resposta = await request(app)
      .post(`/api/organizer/events/${eventId}/checkin`)
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: ticket.code });
    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toBe("Ingresso já utilizado");
  });

  it("R13: organizador de outro evento nao faz check-in (403)", async () => {
    const dono = await criarEventoPublicado();
    const ticket = await criarTicket(dono.eventId, "confirmed");
    const intruso = await criarEventoPublicado();

    // O intruso (outro organizador) tenta check-in no evento alheio.
    await expect(
      checkinService.fazerCheckin(dono.eventId, intruso.organizerId, ticket.code),
    ).rejects.toMatchObject({ codigo: "forbidden", status: 403 });
  });
});
