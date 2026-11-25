// Fixtures mínimas que imitam o que a seed cria, para os testes de contrato.
import bcrypt from "bcryptjs";
import type { PartnerKey, Ticket, TicketStatus, User } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

export async function criarOrganizador(
  email = "organizador@teste.dev",
  senha = "organizador123",
): Promise<{ user: User; senha: string }> {
  const passwordHash = await bcrypt.hash(senha, 8);
  const user = await prisma.user.create({
    data: { name: "Organizador Teste", email, passwordHash, role: "organizer" },
  });
  return { user, senha };
}

export async function criarChaveParceiro(
  key = "chave-de-teste",
  active = true,
): Promise<PartnerKey> {
  return prisma.partnerKey.create({
    data: { key, name: "Parceiro Teste", active },
  });
}

// Cria um ingresso direto no banco para montar cenarios de vagas ocupadas e de
// preco pago (snapshot). F3 criara ingressos pelo fluxo real de compra; aqui o
// insert direto basta para os contratos de F2 que so precisam do estado.
let contadorCodigo = 0;

export async function criarTicket(
  eventId: string,
  status: TicketStatus = "pending",
  pricePaidCents = 1000,
): Promise<Ticket> {
  contadorCodigo += 1;
  return prisma.ticket.create({
    data: {
      eventId,
      code: `TCK-${Date.now()}-${contadorCodigo}`,
      buyerEmail: "comprador@teste.dev",
      status,
      pricePaidCents,
    },
  });
}
