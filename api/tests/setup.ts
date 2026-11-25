// Isolamento de estado: cada teste começa com as tabelas vazias.
import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

const TABELAS = ["Payment", "Ticket", "Event", "PartnerKey", "User"];

beforeEach(async () => {
  // TRUNCATE com CASCADE respeita as FKs e reinicia o estado entre testes.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABELAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
