// Cliente Prisma único da aplicação. Os repositórios são a única porta que o usa;
// serviços e rotas nunca importam o Prisma diretamente.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
