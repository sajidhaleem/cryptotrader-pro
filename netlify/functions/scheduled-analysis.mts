// Netlify Scheduled Function — runs every 30 minutes
// Generates AI trade proposals for all users automatically
import type { Config } from "@netlify/functions";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateProposals } from "../../src/lib/trade-advisor";

export default async function handler() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Get all users who have completed setup (have been active recently)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { paperTrades: { some: {} } },
          { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
      select: { id: true },
    });

    let totalGenerated = 0;
    for (const user of users) {
      try {
        const results = await generateProposals(user.id, "PAPER");
        totalGenerated += results.length;
      } catch (err) {
        console.warn(`[Scheduled] generateProposals failed for user ${user.id}:`, err);
      }
    }

    console.log(`[Scheduled Analysis] Processed ${users.length} users, generated ${totalGenerated} proposals`);
    return new Response(JSON.stringify({ users: users.length, proposals: totalGenerated }), { status: 200 });
  } finally {
    await prisma.$disconnect();
  }
}

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
