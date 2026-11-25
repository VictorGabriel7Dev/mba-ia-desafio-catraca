// Seed idempotente: 2 organizadores + 1 participante + 1 chave de parceiro ativa.
// Usa upsert pela chave natural (e-mail do usuário; key da chave), então rodar
// de novo não duplica nem quebra. Senhas documentadas no AGENTS.md.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CUSTO_BCRYPT = 10;

const SENHA_ORGANIZADOR = "organizador123";
const SENHA_PARTICIPANTE = "participante123";
const CHAVE_PARCEIRO = "parceiro-demo-key-123";

async function upsertUsuario(
  name: string,
  email: string,
  senha: string,
  role: "participant" | "organizer",
): Promise<void> {
  const passwordHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  await prisma.user.upsert({
    where: { email },
    // Não sobrescreve o nome/senha de um usuário real já existente; só garante o papel.
    update: { role },
    create: { name, email, passwordHash, role },
  });
}

async function main(): Promise<void> {
  await upsertUsuario("Ana Organizadora", "ana.organizadora@catraca.dev", SENHA_ORGANIZADOR, "organizer");
  await upsertUsuario("Bruno Organizador", "bruno.organizador@catraca.dev", SENHA_ORGANIZADOR, "organizer");
  await upsertUsuario("Carla Participante", "carla.participante@catraca.dev", SENHA_PARTICIPANTE, "participant");

  await prisma.partnerKey.upsert({
    where: { key: CHAVE_PARCEIRO },
    update: { active: true },
    create: { key: CHAVE_PARCEIRO, name: "Parceiro Demo", active: true },
  });

  console.log("Seed concluída: 2 organizadores, 1 participante, 1 chave de parceiro ativa.");
}

main()
  .catch((erro) => {
    console.error("Falha na seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
