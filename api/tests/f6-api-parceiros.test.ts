// Testes de contrato da F6 (C-F6-01 a C-F6-05): a API de parceiros.
// Tudo via HTTP (supertest contra o app real), como o avaliador faz por curl.
// A chave de parceiro e criada no banco (os testes truncam as tabelas a cada
// caso, entao a seed nao esta presente); usamos o MESMO valor da seed.
import { describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/http/app";
import { prisma } from "../src/lib/prisma";
import * as eventoService from "../src/services/event-service";
import { processarPagamentosVencidos } from "../src/services/payment-worker";
import { criarOrganizador, criarChaveParceiro } from "./fixtures";

const app = criarApp();

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

// Mesma chave de parceiro da seed (README): header X-Api-Key.
const CHAVE = "parceiro-demo-key-123";

// Cartoes de 16 digitos por desfecho (regra do final).
const CARTAO_APROVADO_RAPIDO = "4111111111110001";
const CARTAO_CURTO = "411111"; // menos de 16 digitos -> 422

function dadosEvento(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Show de Jazz",
    startsAt: new Date(Date.now() + UMA_SEMANA_MS).toISOString(),
    location: "Teatro Municipal",
    capacity: 100,
    priceCents: 5000,
    ...overrides,
  };
}

let contadorOrg = 0;

// Cria um organizador e um evento JA PUBLICADO pelo fluxo real do servico.
async function criarEventoPublicado(
  capacity = 100,
  overrides: Record<string, unknown> = {},
): Promise<{ eventId: string; organizerId: string }> {
  contadorOrg += 1;
  const { user } = await criarOrganizador(`org${contadorOrg}@teste.dev`);
  const evento = await eventoService.criar(user.id, dadosEvento({ capacity, ...overrides }));
  await eventoService.publicar(evento.id, user.id);
  return { eventId: evento.id, organizerId: user.id };
}

// Cria um evento em rascunho (nunca publicado).
async function criarEventoRascunho(): Promise<string> {
  contadorOrg += 1;
  const { user } = await criarOrganizador(`org${contadorOrg}@teste.dev`);
  const evento = await eventoService.criar(user.id, dadosEvento());
  return evento.id;
}

async function ocupadasDe(eventId: string): Promise<number> {
  return prisma.ticket.count({
    where: { eventId, status: { in: ["pending", "confirmed"] } },
  });
}

describe("C-F6-01 GET /events lista so publicados nao cancelados com availableSeats", () => {
  it("rascunho e cancelado ficam de fora; o publicado aparece com availableSeats correto", async () => {
    await criarChaveParceiro(CHAVE);

    // Publicado com 2 vagas ocupadas: availableSeats = capacity - ocupadas.
    const { eventId: pub } = await criarEventoPublicado(5, { name: "Publicado" });
    await request(app)
      .post(`/api/partner/events/${pub}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "a@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    await request(app)
      .post(`/api/partner/events/${pub}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "b@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });

    // Rascunho: fora da API.
    await criarEventoRascunho();

    // Cancelado: publicado e depois cancelado, sai de tudo.
    const { eventId: canc, organizerId } = await criarEventoPublicado(10, { name: "Cancelado" });
    await eventoService.cancelar(canc, organizerId);

    const resp = await request(app).get("/api/partner/events").set("X-Api-Key", CHAVE);
    expect(resp.status).toBe(200);
    expect(Array.isArray(resp.body)).toBe(true);
    expect(resp.body).toHaveLength(1);

    const item = resp.body[0];
    expect(item.id).toBe(pub);
    expect(item.name).toBe("Publicado");
    expect(item.priceCents).toBe(5000);
    expect(item.availableSeats).toBe(3); // 5 - 2 ocupadas
    expect(typeof item.startsAt).toBe("string");
    // So os campos do contrato.
    expect(Object.keys(item).sort()).toEqual(
      ["availableSeats", "id", "name", "priceCents", "startsAt"].sort(),
    );
  });
});

describe("C-F6-02 POST /purchases: 202 no caminho feliz e a ordem dos erros", () => {
  it("caminho feliz devolve 202 {ticketId,code,status:pending}", async () => {
    await criarChaveParceiro(CHAVE);
    const { eventId } = await criarEventoPublicado(10);

    const resp = await request(app)
      .post(`/api/partner/events/${eventId}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "feliz@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });

    expect(resp.status).toBe(202);
    expect(resp.body.status).toBe("pending");
    expect(typeof resp.body.ticketId).toBe("string");
    expect(typeof resp.body.code).toBe("string");

    // A compra ocupou uma vaga e nasceu sem vinculo de conta (buyerUserId nulo).
    expect(await ocupadasDe(eventId)).toBe(1);
    const ticket = await prisma.ticket.findUnique({ where: { id: resp.body.ticketId } });
    expect(ticket?.buyerUserId).toBeNull();
    expect(ticket?.buyerEmail).toBe("feliz@externo.dev");
  });

  it("corpo invalido (falta campo) vence o evento inexistente: 422 invalid_request", async () => {
    await criarChaveParceiro(CHAVE);
    // Evento inexistente E corpo sem cardNumber: a verificacao 422 vem antes da 404.
    const resp = await request(app)
      .post(`/api/partner/events/evento-que-nao-existe/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "x@externo.dev" });
    expect(resp.status).toBe(422);
    expect(resp.body.error).toBe("invalid_request");
  });

  it("cartao != 16 digitos vence o evento inexistente: 422 invalid_request", async () => {
    await criarChaveParceiro(CHAVE);
    const resp = await request(app)
      .post(`/api/partner/events/evento-que-nao-existe/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "x@externo.dev", cardNumber: CARTAO_CURTO });
    expect(resp.status).toBe(422);
    expect(resp.body.error).toBe("invalid_request");
  });

  it("e-mail mal formado vence o evento inexistente: 422 invalid_request", async () => {
    await criarChaveParceiro(CHAVE);
    const resp = await request(app)
      .post(`/api/partner/events/evento-que-nao-existe/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "sem-arroba", cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(resp.status).toBe(422);
    expect(resp.body.error).toBe("invalid_request");
  });

  it("evento rascunho com corpo valido: 404 event_not_available", async () => {
    await criarChaveParceiro(CHAVE);
    const rascunho = await criarEventoRascunho();
    const resp = await request(app)
      .post(`/api/partner/events/${rascunho}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "x@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(resp.status).toBe(404);
    expect(resp.body.error).toBe("event_not_available");
  });

  it("evento inexistente com corpo valido: 404 event_not_available", async () => {
    await criarChaveParceiro(CHAVE);
    const resp = await request(app)
      .post(`/api/partner/events/nao-existe/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "x@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(resp.status).toBe(404);
    expect(resp.body.error).toBe("event_not_available");
  });

  it("evento cheio vence corpo valido/404: 409 sold_out (ordem 404 antes de 409)", async () => {
    await criarChaveParceiro(CHAVE);
    const { eventId } = await criarEventoPublicado(1);
    // Ocupa a unica vaga.
    const ok = await request(app)
      .post(`/api/partner/events/${eventId}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "primeiro@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(ok.status).toBe(202);
    // Segunda compra: evento existe e publicado (passa do 404), mas sem vaga -> 409.
    const cheio = await request(app)
      .post(`/api/partner/events/${eventId}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "segundo@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(cheio.status).toBe(409);
    expect(cheio.body.error).toBe("sold_out");
  });
});

describe("C-F6-03 GET /tickets/:id devolve status e checkedIn; inexistente -> 404", () => {
  it("consulta um ingresso criado e um id inexistente", async () => {
    await criarChaveParceiro(CHAVE);
    const { eventId } = await criarEventoPublicado(10);

    const compra = await request(app)
      .post(`/api/partner/events/${eventId}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "consulta@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    const ticketId = compra.body.ticketId as string;

    const resp = await request(app)
      .get(`/api/partner/tickets/${ticketId}`)
      .set("X-Api-Key", CHAVE);
    expect(resp.status).toBe(200);
    expect(resp.body.ticketId).toBe(ticketId);
    expect(resp.body.eventId).toBe(eventId);
    expect(resp.body.status).toBe("pending");
    expect(resp.body.checkedIn).toBe(false);
    expect(typeof resp.body.code).toBe("string");

    const inexistente = await request(app)
      .get(`/api/partner/tickets/nao-existe`)
      .set("X-Api-Key", CHAVE);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toBe("ticket_not_found");
  });
});

describe("C-F6-04 as tres rotas sem X-Api-Key ou com chave invalida -> 401 unauthorized", () => {
  it("sem chave e com chave invalida, 401 nas tres rotas", async () => {
    await criarChaveParceiro(CHAVE);
    const { eventId } = await criarEventoPublicado(5);

    const rotas: Array<() => request.Test> = [
      () => request(app).get("/api/partner/events"),
      () =>
        request(app)
          .post(`/api/partner/events/${eventId}/purchases`)
          .send({ buyerEmail: "z@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO }),
      () => request(app).get(`/api/partner/tickets/qualquer`),
    ];

    for (const fazer of rotas) {
      const semChave = await fazer();
      expect(semChave.status).toBe(401);
      expect(semChave.body.error).toBe("unauthorized");

      const chaveInvalida = await fazer().set("X-Api-Key", "chave-errada");
      expect(chaveInvalida.status).toBe(401);
      expect(chaveInvalida.body.error).toBe("unauthorized");
    }

    // A rota de compra nao criou ingresso quando a chave faltou/errou.
    expect(await ocupadasDe(eventId)).toBe(0);
  });
});

describe("C-F6-05 compra pela API conta na lotacao, no check-in e no cancelamento", () => {
  it("ocupa vaga, o ingresso existe para check-in, confirma pelo worker e estorna no cancelamento", async () => {
    await criarChaveParceiro(CHAVE);
    const { eventId, organizerId } = await criarEventoPublicado(2);

    // Ocupacao antes.
    const antes = await request(app).get("/api/partner/events").set("X-Api-Key", CHAVE);
    expect(antes.body[0].availableSeats).toBe(2);

    // Compra pela API.
    const compra = await request(app)
      .post(`/api/partner/events/${eventId}/purchases`)
      .set("X-Api-Key", CHAVE)
      .send({ buyerEmail: "lotacao@externo.dev", cardNumber: CARTAO_APROVADO_RAPIDO });
    const ticketId = compra.body.ticketId as string;

    // Lotacao reage: availableSeats caiu e ocupadas subiu.
    const depois = await request(app).get("/api/partner/events").set("X-Api-Key", CHAVE);
    expect(depois.body[0].availableSeats).toBe(1);
    expect(await ocupadasDe(eventId)).toBe(1);

    // O ingresso existe para check-in (consulta de parceiro, ainda nao usado).
    const ticket = await request(app)
      .get(`/api/partner/tickets/${ticketId}`)
      .set("X-Api-Key", CHAVE);
    expect(ticket.status).toBe(200);
    expect(ticket.body.checkedIn).toBe(false);

    // O worker confirma o pagamento (relogio adiantado): vira confirmed.
    await processarPagamentosVencidos(new Date(Date.now() + 60_000));
    const confirmado = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(confirmado?.status).toBe("confirmed");

    // Cancelamento do evento estorna o ingresso confirmado (confirmed -> refunded).
    await eventoService.cancelar(eventId, organizerId);
    const estornado = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(estornado?.status).toBe("refunded");
    // E some da API (evento cancelado sai da listagem).
    const sumiu = await request(app).get("/api/partner/events").set("X-Api-Key", CHAVE);
    expect(sumiu.body).toHaveLength(0);
  });
});
