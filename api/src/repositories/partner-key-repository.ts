// Acesso a PartnerKey via Prisma. Única porta de leitura das chaves de parceiro.
import type { PartnerKey } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function buscarAtivaPorChave(chave: string): Promise<PartnerKey | null> {
  return prisma.partnerKey.findFirst({ where: { key: chave, active: true } });
}
