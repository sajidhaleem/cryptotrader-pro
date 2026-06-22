// Autonomous trade advisor — generates proposals for user consent
import { prisma } from "./db";
import { analyzeSymbol } from "./intelligence";

const WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "LINKUSDT", "AVAXUSDT"];
const MIN_CONFIDENCE = 55; // only propose if confidence >= 55%
const PROPOSAL_TTL_HOURS = 4; // proposals expire after 4 hours

export async function generateProposals(userId: string, mode: "PAPER" | "LIVE" = "PAPER") {
  // Don't spam — check if we already have recent pending proposals
  const recentCount = await prisma.tradeProposal.count({
    where: {
      userId,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last 1 hour
    },
  });
  if (recentCount >= 3) return []; // max 3 pending proposals at a time

  // Expire old pending proposals
  await prisma.tradeProposal.updateMany({
    where: { userId, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  const created = [];
  for (const symbol of WATCHLIST) {
    const report = await analyzeSymbol(symbol, userId);
    if (!report || !report.side || report.confidence < MIN_CONFIDENCE) continue;
    if (report.recommendation === "HOLD") continue;

    // Don't duplicate — skip if there's already a pending proposal for this symbol
    const existing = await prisma.tradeProposal.findFirst({
      where: { userId, symbol, status: "PENDING" },
    });
    if (existing) continue;

    // Calculate quantity based on user's paper balance and position size
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { paperBalance: true } });
    const balance = user?.paperBalance ?? 10000;
    const riskAmount = balance * (report.positionSizePct / 100);
    const quantity = riskAmount / report.entryPrice;

    const proposal = await prisma.tradeProposal.create({
      data: {
        userId,
        symbol,
        side: report.side as "BUY" | "SELL",
        quantity,
        entryPrice: report.entryPrice,
        stopLoss: report.stopLoss,
        takeProfit: report.takeProfit,
        confidence: report.confidence,
        mode,
        reasoning: JSON.parse(JSON.stringify({
          recommendation: report.recommendation,
          finalScore: report.finalScore,
          summary: report.summary,
          marketCondition: report.marketCondition,
          fearGreedValue: report.fearGreedValue,
          fearGreedLabel: report.fearGreedLabel,
          riskRewardRatio: report.riskRewardRatio,
          positionSizePct: report.positionSizePct,
          factors: report.factors,
          analysedAt: report.analysedAt,
        })),
        expiresAt: new Date(Date.now() + PROPOSAL_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    created.push({ proposal, report });

    // Save market snapshot for historical tracking
    await prisma.marketSnapshot.create({
      data: {
        symbol,
        price: report.price,
        change24h: 0,
        volume24h: 0,
        fearGreed: report.fearGreedValue,
        signal: report.recommendation,
        score: report.finalScore,
        rsi: report.factors.find((f) => f.indicator === "RSI")?.rawValue as number ?? null,
        macd: report.factors.find((f) => f.indicator === "MACD")?.rawValue as number ?? null,
      },
    }).catch(() => null);

    if (created.length >= 2) break; // max 2 new proposals per run
  }

  return created;
}

export async function getPendingProposals(userId: string) {
  return prisma.tradeProposal.findMany({
    where: { userId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { confidence: "desc" },
  });
}

export async function approveProposal(proposalId: string, userId: string) {
  const proposal = await prisma.tradeProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal || proposal.userId !== userId || proposal.status !== "PENDING") {
    throw new Error("Proposal not found or already actioned");
  }

  if (proposal.expiresAt < new Date()) {
    await prisma.tradeProposal.update({ where: { id: proposalId }, data: { status: "EXPIRED" } });
    throw new Error("Proposal has expired — market conditions may have changed");
  }

  // Execute the trade (paper mode)
  if (proposal.mode === "PAPER") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { paperBalance: true } });
    const balance = user?.paperBalance ?? 0;
    const cost = proposal.quantity * proposal.entryPrice;

    if (proposal.side === "BUY" && cost > balance) {
      throw new Error("Insufficient paper balance");
    }

    const balanceDelta = proposal.side === "BUY" ? -cost : cost;

    await prisma.$transaction([
      prisma.paperTrade.create({
        data: {
          userId,
          symbol: proposal.symbol,
          side: proposal.side,
          quantity: proposal.quantity,
          price: proposal.entryPrice,
          total: cost,
          pnl: 0,
          proposalId: proposal.id,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { paperBalance: { increment: balanceDelta } },
      }),
      prisma.tradeProposal.update({
        where: { id: proposalId },
        data: { status: "EXECUTED", approvedAt: new Date(), executedAt: new Date() },
      }),
    ]);
  }

  return proposal;
}

export async function denyProposal(proposalId: string, userId: string) {
  return prisma.tradeProposal.update({
    where: { id: proposalId, userId },
    data: { status: "DENIED" },
  });
}
