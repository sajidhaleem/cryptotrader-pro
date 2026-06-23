// Outcome tracker — evaluates executed proposals and feeds results back into SignalWeight
// This is the "learning loop": each resolved trade updates per-indicator win/loss counts,
// which intelligence.ts reads via getUserWeights() to adjust future scoring.
import { prisma } from "./db";
import { getPriceCG } from "./market-data";

interface Factor {
  indicator: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
}

interface ProposalReasoning {
  factors?: Factor[];
}

export async function checkAndUpdateOutcomes(userId: string): Promise<number> {
  const window48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const proposals = await prisma.tradeProposal.findMany({
    where: {
      userId,
      status: "EXECUTED",
      outcome: null,
      executedAt: { gte: window48h },
    },
  });

  let resolved = 0;

  for (const p of proposals) {
    // Wait at least 1h before evaluating — give the trade time to breathe
    const executedMs = p.executedAt?.getTime() ?? 0;
    if (Date.now() - executedMs < 60 * 60 * 1000) continue;

    let currentPrice: number;
    try {
      currentPrice = await getPriceCG(p.symbol);
    } catch {
      continue;
    }

    const elapsed = Date.now() - executedMs;
    const hours = elapsed / (60 * 60 * 1000);

    let outcome: "WIN" | "LOSS" | "BREAKEVEN" | null = null;
    let pnl: number | null = null;

    if (p.side === "BUY") {
      if (currentPrice >= p.takeProfit) {
        outcome = "WIN";
        pnl = (p.takeProfit - p.entryPrice) * p.quantity;
      } else if (currentPrice <= p.stopLoss) {
        outcome = "LOSS";
        pnl = (p.stopLoss - p.entryPrice) * p.quantity; // negative
      } else if (hours >= 24) {
        pnl = (currentPrice - p.entryPrice) * p.quantity;
        const pct = (currentPrice - p.entryPrice) / p.entryPrice * 100;
        outcome = pct > 1.5 ? "WIN" : pct < -1.5 ? "LOSS" : "BREAKEVEN";
      }
    } else {
      if (currentPrice <= p.takeProfit) {
        outcome = "WIN";
        pnl = (p.entryPrice - p.takeProfit) * p.quantity;
      } else if (currentPrice >= p.stopLoss) {
        outcome = "LOSS";
        pnl = (p.entryPrice - p.stopLoss) * p.quantity; // negative
      } else if (hours >= 24) {
        pnl = (p.entryPrice - currentPrice) * p.quantity;
        const pct = (p.entryPrice - currentPrice) / p.entryPrice * 100;
        outcome = pct > 1.5 ? "WIN" : pct < -1.5 ? "LOSS" : "BREAKEVEN";
      }
    }

    if (!outcome) continue;

    await prisma.tradeProposal.update({
      where: { id: p.id },
      data: { outcome, pnl, closedAt: new Date() },
    });

    // Update per-indicator signal weights
    const reasoning = p.reasoning as ProposalReasoning;
    const factors: Factor[] = reasoning?.factors ?? [];

    for (const factor of factors) {
      if (factor.signal === "NEUTRAL") continue;

      const agreedWithTrade =
        (p.side === "BUY" && factor.signal === "BUY") ||
        (p.side === "SELL" && factor.signal === "SELL");

      // Factor was right if it agreed with a winning trade (or disagreed with a losing one)
      const wasRight =
        (outcome === "WIN" && agreedWithTrade) ||
        (outcome === "LOSS" && !agreedWithTrade);

      await prisma.signalWeight.upsert({
        where: { userId_indicator: { userId, indicator: factor.indicator } },
        create: {
          userId,
          indicator: factor.indicator,
          wins:   wasRight ? 1 : 0,
          losses: wasRight ? 0 : 1,
          weight: 1.0,
        },
        update: {
          wins:   { increment: wasRight ? 1 : 0 },
          losses: { increment: wasRight ? 0 : 1 },
        },
      });
    }

    resolved++;
  }

  return resolved;
}

export async function getPerformanceSummary(userId: string) {
  const [executed, signalWeights] = await Promise.all([
    prisma.tradeProposal.findMany({
      where: { userId, status: "EXECUTED" },
      select: { outcome: true, pnl: true, confidence: true, side: true, symbol: true, closedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.signalWeight.findMany({ where: { userId } }),
  ]);

  const resolved = executed.filter(p => p.outcome !== null);
  const wins = resolved.filter(p => p.outcome === "WIN").length;
  const losses = resolved.filter(p => p.outcome === "LOSS").length;
  const totalPnl = resolved.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const winRate = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : null;
  const avgConfidence = executed.length > 0
    ? Math.round(executed.reduce((s, p) => s + p.confidence, 0) / executed.length)
    : null;

  const signalAccuracy = signalWeights
    .filter(w => w.wins + w.losses >= 3)
    .map(w => ({
      indicator: w.indicator,
      wins: w.wins,
      losses: w.losses,
      total: w.wins + w.losses,
      winRate: Math.round((w.wins / (w.wins + w.losses)) * 100),
    }))
    .sort((a, b) => b.winRate - a.winRate);

  const recentTrades = resolved.slice(0, 10).map(p => ({
    symbol: p.symbol,
    side: p.side,
    outcome: p.outcome,
    pnl: p.pnl,
    closedAt: p.closedAt,
  }));

  return {
    totalExecuted: executed.length,
    totalResolved: resolved.length,
    wins,
    losses,
    winRate,
    totalPnl,
    avgConfidence,
    signalAccuracy,
    recentTrades,
    learningActive: signalWeights.length > 0,
  };
}
