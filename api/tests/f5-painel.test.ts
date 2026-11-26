// Testes de contrato da F5 (C-F5-01 a C-F5-04): o painel do evento.
// Os seis numeros vem do estado real dos ingressos; a receita usa o
// pricePaidCents (snapshot, R03) de cada ingresso, nunca o preco atual do evento.
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import * as eventoService from "../src/services/event-service";
import * as compras from "../src/services/purchase-service";
import * as stats from "../src/services/stats-service";
import { processarPagamentosVencidos } from "../src/services/payment-worker";
import { criarOrganizador, criarTicket } from "./fixtures";

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const CARTAO_APROVADO_RAPIDO = "4111111111110001";

let contadorOrg = 0;

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

// Cria um organizador e um evento JA PUBLICADO pelo fluxo real do servico.
async function criarEventoPublicado(
  overrides: Record<string, unknown> = {},
): Promise<{ eventId: string; organizerId: string }> {
  contadorOrg += 1;
  const { user } = await criarOrganizador(`org-f5-${contadorOrg}@teste.dev`);
  const evento = await eventoService.criar(user.id, dadosEvento(overrides));
  await eventoService.publicar(evento.id, user.id);
  return { eventId: evento.id, organizerId: user.id };
}

describe("C-F5-01 os seis numeros batem com um cenario conhecido", () => {
  it("confirmados, pendentes, check-ins, vagas, receita e estornados", async () => {
    const { eventId, organizerId } = await criarEventoPublicado({ capacity: 10 });

    // 3 confirmados (precos 1000, 2000, 3000) -> receita 6000; 1 deles com check-in.
    const c1 = await criarTicket(eventId, "confirmed", 1000);
    await criarTicket(eventId, "confirmed", 2000);
    await criarTicket(eventId, "confirmed", 3000);
    await prisma.ticket.update({
      where: { id: c1.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });

    // 2 pendentes, 1 recusado (nao entra na receita), 1 cancelado, 2 estornados.
    await criarTicket(eventId, "pending", 1000);
    await criarTicket(eventId, "pending", 1000);
    await criarTicket(eventId, "declined", 5000);
    await criarTicket(eventId, "cancelled", 1000);
    await criarTicket(eventId, "refunded", 2000);
    await criarTicket(eventId, "refunded", 2000);

    const painel = await stats.painelDoEvento(eventId, organizerId);

    expect(painel.confirmados).toBe(3);
    expect(painel.pendentes).toBe(2);
    expect(painel.checkins).toBe(1);
    // ocupadas = 3 confirmados + 2 pendentes = 5; vagas = 10 - 5.
    expect(painel.vagasDisponiveis).toBe(5);
    // receita = soma de pricePaidCents dos CONFIRMADOS (1000 + 2000 + 3000).
    expect(painel.receitaCents).toBe(6000);
    expect(painel.estornados).toBe(2);
  });
});

describe("C-F5-02 confirmar sobe Confirmados e Receita; cancelar reflete Estornados", () => {
  it("confirmar incrementa; cancelar passa os confirmados para estornados", async () => {
    const { eventId, organizerId } = await criarEventoPublicado({ capacity: 5, priceCents: 5000 });

    await compras.comprar({
      eventId,
      buyerEmail: "comprador@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });

    const antes = await stats.painelDoEvento(eventId, organizerId);
    expect(antes.pendentes).toBe(1);
    expect(antes.confirmados).toBe(0);
    expect(antes.receitaCents).toBe(0);

    // Adianta o relogio alem da faixa (40s) para o worker confirmar.
    await processarPagamentosVencidos(new Date(Date.now() + 60_000));

    const depois = await stats.painelDoEvento(eventId, organizerId);
    expect(depois.confirmados).toBe(antes.confirmados + 1);
    expect(depois.receitaCents).toBe(antes.receitaCents + 5000);

    // Cancelar o evento: o confirmado vira estornado; vagas zeram (R05).
    await eventoService.cancelar(eventId, organizerId);
    const cancelado = await stats.painelDoEvento(eventId, organizerId);
    expect(cancelado.estornados).toBe(1);
    expect(cancelado.confirmados).toBe(0);
    expect(cancelado.vagasDisponiveis).toBe(0);
  });
});

describe("C-F5-03 vagas disponiveis = lotacao menos ocupadas e sobem com a lotacao", () => {
  it("aumentar a capacity faz as vagas disponiveis subirem", async () => {
    const { eventId, organizerId } = await criarEventoPublicado({ capacity: 5 });

    // Duas vagas ocupadas (1 pendente + 1 confirmado).
    await criarTicket(eventId, "pending");
    await criarTicket(eventId, "confirmed");

    const antes = await stats.painelDoEvento(eventId, organizerId);
    expect(antes.vagasDisponiveis).toBe(3); // 5 - 2

    // Aumenta a lotacao para 10 pelo fluxo real de edicao.
    await eventoService.editar(eventId, organizerId, dadosEvento({ capacity: 10 }));

    const depois = await stats.painelDoEvento(eventId, organizerId);
    expect(depois.vagasDisponiveis).toBe(8); // 10 - 2
  });
});

describe("C-F5-04 receita usa o pricePaidCents de cada ingresso, nao o preco atual", () => {
  it("comprar, mudar o preco, comprar e confirmar ambos soma os dois precos pagos", async () => {
    const { eventId, organizerId } = await criarEventoPublicado({ capacity: 10, priceCents: 5000 });

    // Primeira compra com o preco vigente (5000).
    await compras.comprar({
      eventId,
      buyerEmail: "a@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });

    // Muda o preco do evento para 8000.
    await eventoService.editar(eventId, organizerId, dadosEvento({ capacity: 10, priceCents: 8000 }));

    // Segunda compra com o novo preco (8000).
    await compras.comprar({
      eventId,
      buyerEmail: "b@teste.dev",
      cardNumber: CARTAO_APROVADO_RAPIDO,
    });

    // Confirma as duas compras.
    await processarPagamentosVencidos(new Date(Date.now() + 60_000));

    const painel = await stats.painelDoEvento(eventId, organizerId);
    expect(painel.confirmados).toBe(2);
    // Receita = 5000 + 8000, os precos PAGOS; nao 2 x 8000 (preco atual).
    expect(painel.receitaCents).toBe(13000);
    expect(painel.receitaCents).not.toBe(16000);
  });
});
