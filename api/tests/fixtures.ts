// Fixtures mínimas que imitam o que a seed cria, para os testes de contrato.
import bcrypt from "bcryptjs";
import type { PartnerKey, User } from "@prisma/client";
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
