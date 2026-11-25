// Acesso a User via Prisma. Única porta de leitura/escrita de usuários.
import type { Role, User } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface NovoUsuario {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export async function buscarPorEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function buscarPorId(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function criar(dados: NovoUsuario): Promise<User> {
  return prisma.user.create({ data: dados });
}
