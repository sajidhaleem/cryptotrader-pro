import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Single-owner personal tool — auto-creates the owner on first use
export async function getOwnerId(): Promise<string> {
  const email = process.env.OWNER_EMAIL ?? "owner@personal.local";
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "You" },
    update: {},
    select: { id: true },
  });
  return user.id;
}
