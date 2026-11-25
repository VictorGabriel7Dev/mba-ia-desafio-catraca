// Testes de contrato da F3 (C-F3-01 a C-F3-09): compra, vagas e pagamento.
// O teste de concorrencia C-F3-04 e REAL: 30 compras simultaneas contra o
// Postgres de teste, provando a reserva atomica (R07).
import { describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/http/app";
import { prisma } from "../src/lib/prisma";
import { ErroAplicacao } from "../src/lib/errors";
import * as eventoService from "../src/services/event-service";
import * as compras from "../src/services/purchase-service";
import { processarPagamentosVencidos } from "../src/services/payment-worker";
import { criarOrganizador, criarTicket } from "./fixtures";

const app = criarApp();

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

// Cartoes de 16 digitos por desfecho (regra do final).
const CARTAO_APROVADO_RAPIDO = "4111111111110001";
const CARTAO_RECUSADO_RAPIDO = "4111111111110002";
const CARTAO_APROVADO_LENTO = "4111111111110003";
const CARTAO_RECUSADO_LENTO = "4111111111110004";
const CARTAO_OUTRO = "4111111111119999";

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
): Promise<{ eventId: string; organizerId: string }> {
  contadorOrg += 1;
  const { user } = await criarOrganizador(`org${contadorOrg}@teste.dev`);
  const evento = await eventoService.criar(user.id, dadosEvento({ capacity }));
  await eventoService.publicar(evento.id, user.id);
  return { eventId: evento.id, organizerId: user.id };
}

// Cria um evento em rascunho (nao publicado).
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

describe("C-F3-01 ocupadas = pending + confirmed; cancelado = 0", () => {
  it("conta ocupadas e disponiveis por status e zera no evento cancelado", async () => {
    const { eventId, organizerId } = await criarEventoPublicado(5);

    await criarTicket(eventId, "pending");
    await criarTicket(eventId, "confirmed");
    await criarTicket(eventId, "declined");
    await criarTicket(eventId, "cancelled");

    const antes = await compras.disponibilidade(eventId);
    expect(antes.ocupadas).toBe(2); // 1 pending + 1 confirmed
    expect(antes.disponiveis).toBe(3); // 5 - 2

    await eventoService.cancelar(eventId, organizerId);
    const depois = await compras.disponibilidade(eventId);
    expect(depois.disponiveis).toBe(0);
  });
});

describe("C-F3-02 compra nasce pending, ocupa vaga e responde sem esperar o gateway", () => {
  it("o ingresso retorna pending e o pagamento ainda nao foi processado", async () => {
    const { eventId } = await criarEventoPublicado(10);

    const antes = await compras.disponibilidade(eventId);
    const ingresso = await compras.comprar({
      eventId,
      buyerEmail: "comprador@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });

    expect(ingresso.status).toBe("pending");

    const depois = await compras.disponibilidade(eventId);
    expect(depois.ocupadas).toBe(antes.ocupadas + 1);

    // Responde sem esperar o gateway: o Payment nasce nao processado.
    const pagamento = await prisma.payment.findUnique({ where: { ticketId: ingresso.id } });
    expect(pagamento?.processedAt).toBeNull();
    expect(pagamento?.resolveAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("C-F3-03 evento lotado responde sold_out", () => {
  it("servico lanca sold_out e a API responde 409 sold_out", async () => {
    const { eventId } = await criarEventoPublicado(1);

    // Primeira compra ocupa a unica vaga.
    await compras.comprar({
      eventId,
      buyerEmail: "primeiro@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });

    // Servico: a segunda compra lanca sold_out.
    await expect(
      compras.comprar({
        eventId,
        buyerEmail: "segundo@teste.dev",
        cardNumber: CARTAO_APROVADO_RAPIDO,
      }),
    ).rejects.toMatchObject({ codigo: "sold_out", status: 409 });

    // API (equivalente ao curl): participante logado tenta comprar e recebe 409.
    const cadastro = await request(app).post("/api/auth/register").send({
      name: "Participante",
      email: "participante3@teste.dev",
      password: "participante123",
    });
    const token = cadastro.body.token as string;
    const resposta = await request(app)
      .post(`/api/events/${eventId}/purchases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(resposta.status).toBe(409);
    expect(resposta.body.error).toBe("sold_out");
  });
});

describe("C-F3-04 reserva atomica sob 30 compras simultaneas (R07)", () => {
  it("evento com lotacao 10: exatamente 10 aceitas, 20 sold_out, ocupadas nunca passa de 10", async () => {
    const N = 10;
    const { eventId } = await criarEventoPublicado(N);

    // 30 compras REALMENTE simultaneas contra o Postgres de teste real.
    const resultados = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        compras
          .comprar({
            eventId,
            buyerEmail: `comprador${i}@teste.dev`,
            cardNumber: CARTAO_APROVADO_RAPIDO,
          })
          .then(() => "ok" as const)
          .catch((erro: unknown) => {
            if (erro instanceof ErroAplicacao && erro.codigo === "sold_out") {
              return "sold_out" as const;
            }
            throw erro;
          }),
      ),
    );

    const aceitas = resultados.filter((r) => r === "ok").length;
    const recusadas = resultados.filter((r) => r === "sold_out").length;
    expect(aceitas).toBe(N);
    expect(recusadas).toBe(30 - N);

    // As ocupadas nunca passaram de N (overselling nao aconteceu).
    const ocupadas = await ocupadasDe(eventId);
    expect(ocupadas).toBe(N);
    const total = await prisma.ticket.count({ where: { eventId } });
    expect(total).toBe(N);
  });
});

describe("C-F3-05 o gateway confirma ou recusa pelo final do cartao", () => {
  it("0001/0003 viram confirmed; 0002/0004/outro viram declined e liberam a vaga", async () => {
    const { eventId } = await criarEventoPublicado(10);

    const aprovadoRapido = await compras.comprar({
      eventId,
      buyerEmail: "a@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });
    const aprovadoLento = await compras.comprar({
      eventId,
      buyerEmail: "b@teste.dev",
      cardNumber: CARTAO_APROVADO_LENTO,
    });
    const recusadoRapido = await compras.comprar({
      eventId,
      buyerEmail: "c@teste.dev",
      cardNumber: CARTAO_RECUSADO_RAPIDO,
    });
    const recusadoLento = await compras.comprar({
      eventId,
      buyerEmail: "d@teste.dev",
      cardNumber: CARTAO_RECUSADO_LENTO,
    });
    const outro = await compras.comprar({
      eventId,
      buyerEmail: "e@teste.dev",
      cardNumber: CARTAO_OUTRO,
    });

    // 5 ingressos pending ocupam vaga enquanto o gateway nao resolve.
    expect(await ocupadasDe(eventId)).toBe(5);

    // Relogio adiantado alem da maior faixa (40s): processa tudo que venceu.
    const futuro = new Date(Date.now() + 60_000);
    const resumo = await processarPagamentosVencidos(futuro);
    expect(resumo.processados).toBe(5);
    expect(resumo.confirmados).toBe(2);
    expect(resumo.recusados).toBe(3);

    const estado = async (id: string): Promise<string | undefined> =>
      (await prisma.ticket.findUnique({ where: { id } }))?.status;
    expect(await estado(aprovadoRapido.id)).toBe("confirmed");
    expect(await estado(aprovadoLento.id)).toBe("confirmed");
    expect(await estado(recusadoRapido.id)).toBe("declined");
    expect(await estado(recusadoLento.id)).toBe("declined");
    expect(await estado(outro.id)).toBe("declined");

    // A vaga dos recusados voltou: so os 2 confirmados ocupam.
    expect(await ocupadasDe(eventId)).toBe(2);
  });
});

describe("C-F3-06 resposta tardia nao reverte um ingresso ja cancelado", () => {
  it("cancelar antes de processar: o processamento condicional nao muda o status", async () => {
    const { eventId, organizerId } = await criarEventoPublicado(5);
    const ingresso = await compras.comprar({
      eventId,
      buyerEmail: "tardio@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO, // aprovaria, se processasse
    });

    // Cancela o evento: pending -> cancelled.
    await eventoService.cancelar(eventId, organizerId);
    expect((await prisma.ticket.findUnique({ where: { id: ingresso.id } }))?.status).toBe(
      "cancelled",
    );

    // Processa com o relogio no futuro: nao reverte para confirmed.
    await processarPagamentosVencidos(new Date(Date.now() + 60_000));
    expect((await prisma.ticket.findUnique({ where: { id: ingresso.id } }))?.status).toBe(
      "cancelled",
    );
  });
});

describe("C-F3-07 codigo unico e Meus ingressos", () => {
  it("codigos distintos e a listagem traz evento, status e codigo", async () => {
    const { eventId } = await criarEventoPublicado(10);

    // Participante logado para vincular a conta.
    const cadastro = await request(app).post("/api/auth/register").send({
      name: "Participante",
      email: "p7@teste.dev",
      password: "participante123",
    });
    const userId = cadastro.body.user.id as string;

    const i1 = await compras.comprarComoParticipante(eventId, userId, CARTAO_APROVADO_RAPIDO);
    const i2 = await compras.comprarComoParticipante(eventId, userId, CARTAO_RECUSADO_RAPIDO);
    expect(i1.code).toBeTruthy();
    expect(i2.code).toBeTruthy();
    expect(i1.code).not.toBe(i2.code);

    const meus = await compras.listarIngressosDoParticipante(userId);
    expect(meus).toHaveLength(2);
    for (const m of meus) {
      expect(m.evento.id).toBe(eventId);
      expect(m.code).toBeTruthy();
      expect(["pending", "confirmed", "declined", "cancelled", "refunded"]).toContain(m.status);
    }
  });
});

describe("C-F3-08 comprar evento em rascunho ou cancelado falha", () => {
  it("rascunho e cancelado respondem event_not_available (404)", async () => {
    // Rascunho (nunca publicado).
    const rascunho = await criarEventoRascunho();
    await expect(
      compras.comprar({ eventId: rascunho, buyerEmail: "x@teste.dev", cardNumber: CARTAO_APROVADO_RAPIDO }),
    ).rejects.toMatchObject({ codigo: "event_not_available", status: 404 });

    // Cancelado (publicado e depois cancelado).
    const { eventId, organizerId } = await criarEventoPublicado(5);
    await eventoService.cancelar(eventId, organizerId);
    await expect(
      compras.comprar({ eventId, buyerEmail: "y@teste.dev", cardNumber: CARTAO_APROVADO_RAPIDO }),
    ).rejects.toMatchObject({ codigo: "event_not_available", status: 404 });

    // API: participante tentando comprar um rascunho tambem recebe 404.
    const cadastro = await request(app).post("/api/auth/register").send({
      name: "Participante",
      email: "p8@teste.dev",
      password: "participante123",
    });
    const token = cadastro.body.token as string;
    const resposta = await request(app)
      .post(`/api/events/${rascunho}/purchases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(resposta.status).toBe(404);
    expect(resposta.body.error).toBe("event_not_available");
  });
});

describe("C-F3-09 vitrine vincula a conta; API nao vincula mas conta para lotacao", () => {
  it("compra pela vitrine preenche buyerUserId; compra pela API fica com buyerUserId nulo", async () => {
    const { eventId } = await criarEventoPublicado(10);

    // Vitrine: participante logado compra pelo endpoint HTTP.
    const cadastro = await request(app).post("/api/auth/register").send({
      name: "Participante",
      email: "p9@teste.dev",
      password: "participante123",
    });
    const userId = cadastro.body.user.id as string;
    const token = cadastro.body.token as string;

    const compra = await request(app)
      .post(`/api/events/${eventId}/purchases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cardNumber: CARTAO_APROVADO_RAPIDO });
    expect(compra.status).toBe(201);
    expect(compra.body.buyerUserId).toBe(userId);

    const meus = await request(app)
      .get("/api/me/tickets")
      .set("Authorization", `Bearer ${token}`);
    expect(meus.status).toBe(200);
    expect(meus.body).toHaveLength(1);
    expect(meus.body[0].evento.id).toBe(eventId);

    // API de parceiros (caminho sem buyerUserId): conta para lotacao, sem vinculo.
    const viaApi = await compras.comprar({
      eventId,
      buyerEmail: "parceiro@externo.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });
    expect(viaApi.buyerUserId).toBeNull();

    // Ambas ocupam vaga.
    expect(await ocupadasDe(eventId)).toBe(2);
    // A compra via API nao aparece em "Meus ingressos" do participante.
    const meusAgora = await compras.listarIngressosDoParticipante(userId);
    expect(meusAgora).toHaveLength(1);
  });
});
