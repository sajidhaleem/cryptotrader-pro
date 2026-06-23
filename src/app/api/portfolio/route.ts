import { prisma, getOwnerId } from "@/lib/db";
import { getAccountBalance, POPULAR_PAIRS } from "@/lib/binance";
import { get24hrStatsBatchCG } from "@/lib/market-data";
import { decrypt } from "@/lib/utils";

export async function GET() {
  const userId = await getOwnerId();
  const encKey = process.env.ENCRYPTION_KEY ?? "";

  // Live portfolio (if API keys exist)
  let liveBalances = null;
  const apiKey = await prisma.binanceApiKey.findFirst({
    where: { userId, isActive: true },
  });
  const hasApiKey = !!apiKey;

  if (apiKey) {
    try {
      const decryptedKey = decrypt(apiKey.apiKey, encKey);
      const decryptedSecret = decrypt(apiKey.secretKey, encKey);
      liveBalances = await getAccountBalance(
        decryptedKey,
        decryptedSecret,
        apiKey.isTestnet
      );
    } catch {
      // Balance fetch failed (likely geo-restricted from deployment server) but key IS saved
    }
  }

  // Get current prices + 24h change for top pairs (via CoinGecko — Binance public API is geo-blocked on Netlify)
  const ticker24h = await get24hrStatsBatchCG(POPULAR_PAIRS);
  const prices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};
  for (const [sym, t] of Object.entries(ticker24h)) {
    prices[sym] = t.price;
    priceChanges[sym] = t.priceChangePercent;
  }

  // Stats
  const totalTrades = await prisma.trade.count({ where: { userId } });
  const executedProposals = await prisma.tradeProposal.count({ where: { userId, status: "EXECUTED" } });
  const activeBots = await prisma.bot.count({
    where: { userId, status: "RUNNING" },
  });

  return Response.json({
    hasApiKey,
    liveBalances,
    prices,
    priceChanges,
    stats: {
      totalTrades,
      executedProposals,
      activeBots,
    },
  });
}
