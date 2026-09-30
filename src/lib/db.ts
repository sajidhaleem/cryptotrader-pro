import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cookies } from "next/headers";
import { OWNER_COOKIE, isOwnerToken } from "./owner";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const DEMO_EMAIL = "demo@cryptotrader.local";

/** True only for a request carrying the owner cookie (see lib/owner.ts). */
export async function isOwner(): Promise<boolean> {
  return isOwnerToken((await cookies()).get(OWNER_COOKIE)?.value);
}

// Single-owner personal tool — auto-creates the user on first use. Public
// visitors get the demo user instead: no API key, and the proxy refuses their
// writes, so nothing they do can reach the owner's account or data.
export async function getOwnerId(): Promise<string> {
  const email = (await isOwner()) ? (process.env.OWNER_EMAIL ?? "owner@personal.local") : DEMO_EMAIL;
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "You" },
    update: {},
    select: { id: true },
  });
  return user.id;
}
