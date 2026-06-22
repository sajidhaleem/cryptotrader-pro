// Netlify Scheduled Function — runs every 30 minutes
// Generates AI proposals, executes bots, monitors open positions
import type { Config } from "@netlify/functions";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateProposals } from "../../src/lib/trade-advisor";
import { runAllBots } from "../../src/lib/bots";
import { recordOutcome } from "../../src/lib/intelligence";
import { getPrice } from "../../src/lib/binance";

export default async function handler() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { paperTrades: { some: {} } },
          { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600e3) } },
        ],
      },
      select: { id: true },
    });

    let totalProposals  = 0;
    let totalBotActions = 0;
    let positionsChecked = 0;

    for (const user of users) {

      // 1 — Generate AI proposals
      try {
        const proposals = await generateProposals(user.id, "PAPER");
        totalProposals += proposals.length;
      } catch (err) {
        console.warn(`[Scheduled] proposals failed for ${user.id}:`, err);
      }

      // 2 — Run active bots
      try {
        const botResults = await runAllBots(user.id);
        const executed = botResults.filter(r =>
          r.result.includes("BUY") || r.result.includes("SELL")
        ).length;
        totalBotActions += executed;
        if (botResults.length > 0) {
          console.log(`[Bots] user=${user.id}:`, botResults.map(r => `${r.name}: ${r.result}`).join(" | "));
        }
      } catch (err) {
        console.warn(`[Scheduled] bots failed for ${user.id}:`, err);
      }

      // 3 — Monitor open paper positions (check stop loss / take profit)
      try {
        const open = await prisma.tradeProposal.findMany({
          where: { userId: user.id, status: "EXECUTED", closedAt: null, mode: "PAPER" },
        });

        for (const proposal of open) {
          positionsChecked++;
          try {
            const price  = await getPrice(proposal.symbol);
            const isBuy  = proposal.side === "BUY";
            const hitStop   = isBuy ? price <= proposal.stopLoss  : price >= proposal.stopLoss;
            const hitTarget = isBuy ? price >= proposal.takeProfit : price <= proposal.takeProfit;

            if (!hitStop && !hitTarget) continue;

            const won = hitTarget;
            const pnl = isBuy
              ? (price - proposal.entryPrice) * proposal.quantity
              : (proposal.entryPrice - price) * proposal.quantity;

            // Close the position atomically
            await prisma.$transaction([
              prisma.paperTrade.create({
                data: {
                  userId:     user.id,
                  symbol:     proposal.symbol,
                  side:       isBuy ? "SELL" : "BUY",
                  quantity:   proposal.quantity,
                  price,
                  total:      proposal.quantity * price,
                  pnl,
                  status:     "FILLED",
                  proposalId: proposal.id,
                },
              }),
              prisma.user.update({
                where: { id: user.id },
                data:  { paperBalance: { increment: proposal.quantity * price } },
              }),
              prisma.tradeProposal.update({
                where: { id: proposal.id },
                data:  {
                  closedAt: new Date(),
                  pnl,
                  outcome: won ? "WIN" : "LOSS",
                },
              }),
            ]);

            // Feed outcome back into adaptive learning
            await recordOutcome(user.id, proposal.id, won);
            console.log(`[Monitor] ${proposal.symbol} ${won ? "WIN" : "LOSS"} PnL=$${pnl.toFixed(2)}`);
          } catch (err) {
            console.warn(`[Monitor] proposal ${proposal.id} check failed:`, err);
          }
        }
      } catch (err) {
        console.warn(`[Scheduled] position monitor failed for ${user.id}:`, err);
      }
    }

    const summary = { users: users.length, proposals: totalProposals, botActions: totalBotActions, positionsChecked };
    console.log("[Scheduled]", summary);
    return new Response(JSON.stringify(summary), { status: 200 });
  } finally {
    await prisma.$disconnect();
  }
}

export const config: Config = {
  schedule: "*/30 * * * *",
};
