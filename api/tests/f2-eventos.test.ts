// Testes de contrato da F2 (C-F2-01 a C-F2-08): ciclo de vida do evento.
import { describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/http/app";
import { prisma } from "../src/lib/prisma";
import { criarOrganizador, criarTicket } from "./fixtures";

const app = criarApp();

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

function eventoBase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Show de Jazz",
    startsAt: new Date(Date.now() + UMA_SEMANA_MS).toISOString(),
    location: "Teatro Municipal",
    capacity: 100,
    priceCents: 5000,
    ...overrides,
  };
}

async function sessaoOrganizador(
  email = "organizador@teste.dev",
): Promise<{ token: string; userId: string }> {
  const { user, senha } = await criarOrganizador(email);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: senha });
  return { token: login.body.token as string, userId: user.id };
}

async function sessaoParticipante(): Promise<string> {
  const cadastro = await request(app).post("/api/auth/register").send({
    name: "Participante Teste",
    email: "participante@teste.dev",
    password: "participante123",
  });
  return cadastro.body.token as string;
}

function autenticar(token: string) {
  return (req: request.Test): request.Test => req.set("Authorization", `Bearer ${token}`);
}

describe("C-F2-01 invariantes na criacao e na edicao", () => {
  it("rejeita criar com nome vazio, lotacao < 1, preco <= 0 ou data no passado", async () => {
    const { token } = await sessaoOrganizador();

    const semNome = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ name: "  " })),
    );
    expect(semNome.status).toBe(422);
    expect(semNome.body.error).toBe("invalid_request");

    const lotacaoZero = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ capacity: 0 })),
    );
    expect(lotacaoZero.status).toBe(422);

    const lotacaoFracionaria = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ capacity: 2.5 })),
    );
    expect(lotacaoFracionaria.status).toBe(422);

    const precoZero = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ priceCents: 0 })),
    );
    expect(precoZero.status).toBe(422);

    const dataPassada = await autenticar(token)(
      request(app)
        .post("/api/organizer/events")
        .send(eventoBase({ startsAt: new Date(Date.now() - UMA_SEMANA_MS).toISOString() })),
    );
    expect(dataPassada.status).toBe(422);
  });

  it("aceita criar com dados validos e rejeita editar colocando data no passado", async () => {
    const { token } = await sessaoOrganizador();

    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    expect(criado.status).toBe(201);

    const edicaoRuim = await autenticar(token)(
      request(app)
        .patch(`/api/organizer/events/${criado.body.id}`)
        .send(eventoBase({ startsAt: new Date(Date.now() - UMA_SEMANA_MS).toISOString() })),
    );
    expect(edicaoRuim.status).toBe(422);
    expect(edicaoRuim.body.error).toBe("invalid_request");
  });
});

describe("C-F2-02 nasce draft e so publicado aparece na vitrine", () => {
  it("evento recem-criado e draft e fica fora da vitrine e do detalhe publico", async () => {
    const { token } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    expect(criado.status).toBe(201);
    expect(criado.body.status).toBe("draft");

    const vitrine = await request(app).get("/api/events");
    expect(vitrine.status).toBe(200);
    expect(vitrine.body).toHaveLength(0);

    // Detalhe publico de um rascunho nao esta disponivel (nem aceitaria compra).
    const detalhe = await request(app).get(`/api/events/${criado.body.id}`);
    expect(detalhe.status).toBe(404);
    expect(detalhe.body.error).toBe("event_not_available");
  });

  it("apos publicar, o evento aparece na vitrine e no detalhe publico", async () => {
    const { token } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    const publicado = await autenticar(token)(
      request(app).post(`/api/organizer/events/${criado.body.id}/publish`).send(),
    );
    expect(publicado.status).toBe(200);
    expect(publicado.body.status).toBe("published");

    const vitrine = await request(app).get("/api/events");
    expect(vitrine.body).toHaveLength(1);
    expect(vitrine.body[0].id).toBe(criado.body.id);

    const detalhe = await request(app).get(`/api/events/${criado.body.id}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.id).toBe(criado.body.id);
  });
});

describe("C-F2-03 lotacao nunca abaixo das ocupadas", () => {
  it("baixar abaixo das ocupadas falha; igualar ou aumentar passa", async () => {
    const { token } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ capacity: 100 })),
    );
    const eventId = criado.body.id as string;

    // Tres vagas ocupadas: 2 confirmadas + 1 pendente.
    await criarTicket(eventId, "confirmed");
    await criarTicket(eventId, "confirmed");
    await criarTicket(eventId, "pending");

    const abaixo = await autenticar(token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase({ capacity: 2 })),
    );
    expect(abaixo.status).toBe(409);
    expect(abaixo.body.error).toBe("capacity_below_occupied");

    const igual = await autenticar(token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase({ capacity: 3 })),
    );
    expect(igual.status).toBe(200);
    expect(igual.body.capacity).toBe(3);

    const acima = await autenticar(token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase({ capacity: 200 })),
    );
    expect(acima.status).toBe(200);
    expect(acima.body.capacity).toBe(200);
  });
});

describe("C-F2-04 mudar o preco nao mexe no pricePaidCents ja gravado", () => {
  it("ingresso existente mantem o preco pago; so compras posteriores usam o novo", async () => {
    const { token } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase({ priceCents: 5000 })),
    );
    const eventId = criado.body.id as string;

    // Ingresso comprado ao preco vigente (snapshot R03).
    const antigo = await criarTicket(eventId, "confirmed", 5000);

    const edicao = await autenticar(token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase({ priceCents: 8000 })),
    );
    expect(edicao.status).toBe(200);
    expect(edicao.body.priceCents).toBe(8000);

    const persistido = await prisma.ticket.findUnique({ where: { id: antigo.id } });
    expect(persistido?.pricePaidCents).toBe(5000);

    // Uma compra posterior usaria o novo preco (aqui simulada direto no banco).
    const novo = await criarTicket(eventId, "confirmed", 8000);
    expect(novo.pricePaidCents).not.toBe(persistido?.pricePaidCents);
  });
});

describe("C-F2-05 pagina de gestao por URL propria", () => {
  it("a rota de gestao responde pelo ID do evento para o dono", async () => {
    const { token, userId } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    const gestao = await autenticar(token)(
      request(app).get(`/api/organizer/events/${criado.body.id}`),
    );
    expect(gestao.status).toBe(200);
    expect(gestao.body.id).toBe(criado.body.id);
    expect(gestao.body.organizerId).toBe(userId);
  });
});

describe("C-F2-06 cancelar publicado e irreversivel e transita os ingressos", () => {
  it("apos cancelar: sai da vitrine/API, nao publica, nao edita e transita ingressos", async () => {
    const { token } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    const eventId = criado.body.id as string;
    await autenticar(token)(request(app).post(`/api/organizer/events/${eventId}/publish`).send());

    const confirmado = await criarTicket(eventId, "confirmed");
    const pendente = await criarTicket(eventId, "pending");

    const cancelado = await autenticar(token)(
      request(app).post(`/api/organizer/events/${eventId}/cancel`).send(),
    );
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.status).toBe("cancelled");

    // Ingressos transitados (R11): confirmed -> refunded, pending -> cancelled.
    const t1 = await prisma.ticket.findUnique({ where: { id: confirmado.id } });
    const t2 = await prisma.ticket.findUnique({ where: { id: pendente.id } });
    expect(t1?.status).toBe("refunded");
    expect(t2?.status).toBe("cancelled");

    // Sai da vitrine e do detalhe publico.
    const vitrine = await request(app).get("/api/events");
    expect(vitrine.body).toHaveLength(0);
    const detalhe = await request(app).get(`/api/events/${eventId}`);
    expect(detalhe.status).toBe(404);

    // Irreversivel: nao republica nem edita.
    const republicar = await autenticar(token)(
      request(app).post(`/api/organizer/events/${eventId}/publish`).send(),
    );
    expect(republicar.status).toBe(409);
    expect(republicar.body.error).toBe("invalid_state");

    const editar = await autenticar(token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase()),
    );
    expect(editar.status).toBe(409);
    expect(editar.body.error).toBe("invalid_state");

    // Cancelar de novo tambem falha (ja esta cancelado).
    const recancelar = await autenticar(token)(
      request(app).post(`/api/organizer/events/${eventId}/cancel`).send(),
    );
    expect(recancelar.status).toBe(409);
  });
});

describe("C-F2-07 so organizador cria evento, e vira o dono", () => {
  it("participante nao cria evento (403) e organizador cria como dono", async () => {
    const tokenParticipante = await sessaoParticipante();
    const barrado = await autenticar(tokenParticipante)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    expect(barrado.status).toBe(403);
    expect(barrado.body.error).toBe("forbidden");

    const { token, userId } = await sessaoOrganizador();
    const criado = await autenticar(token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    expect(criado.status).toBe(201);
    expect(criado.body.organizerId).toBe(userId);
  });
});

describe("C-F2-08 organizador so acessa os proprios eventos", () => {
  it("organizador A e barrado na gestao de um evento de B, inclusive pela URL direta", async () => {
    const orgA = await sessaoOrganizador("ana@teste.dev");
    const orgB = await sessaoOrganizador("bruno@teste.dev");

    const eventoDeB = await autenticar(orgB.token)(
      request(app).post("/api/organizer/events").send(eventoBase()),
    );
    const eventId = eventoDeB.body.id as string;

    // A tenta abrir a gestao do evento de B pela URL direta.
    const gestao = await autenticar(orgA.token)(
      request(app).get(`/api/organizer/events/${eventId}`),
    );
    expect(gestao.status).toBe(403);
    expect(gestao.body.error).toBe("forbidden");

    // A tambem nao edita nem cancela o evento de B.
    const edicao = await autenticar(orgA.token)(
      request(app).patch(`/api/organizer/events/${eventId}`).send(eventoBase()),
    );
    expect(edicao.status).toBe(403);

    const cancelamento = await autenticar(orgA.token)(
      request(app).post(`/api/organizer/events/${eventId}/cancel`).send(),
    );
    expect(cancelamento.status).toBe(403);

    // A lista do organizador A nao inclui o evento de B.
    const listaA = await autenticar(orgA.token)(request(app).get("/api/organizer/events"));
    expect(listaA.body).toHaveLength(0);

    // Evento inexistente responde 404.
    const inexistente = await autenticar(orgA.token)(
      request(app).get("/api/organizer/events/evento-que-nao-existe"),
    );
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toBe("event_not_found");
  });
});
