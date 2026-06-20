import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAccountBalance, getPrices, POPULAR_PAIRS } from "@/lib/binance";
import { decrypt } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const encKey = process.env.ENCRYPTION_KEY ?? "";

  // Paper portfolio
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const paperTrades = await prisma.paperTrade.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Live portfolio (if API keys exist)
  let liveBalances = null;
  const apiKey = await prisma.binanceApiKey.findFirst({
    where: { userId, isActive: true },
  });

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
      // silently fail if API key is invalid
    }
  }

  // Get current prices for top pairs
  const prices = await getPrices(POPULAR_PAIRS);

  // Stats
  const totalTrades = await prisma.trade.count({ where: { userId } });
  const paperTradeCount = await prisma.paperTrade.count({ where: { userId } });
  const activeBots = await prisma.bot.count({
    where: { userId, status: "RUNNING" },
  });

  return Response.json({
    paperBalance: user?.paperBalance ?? 10000,
    paperTrades,
    liveBalances,
    prices,
    stats: {
      totalTrades,
      paperTradeCount,
      activeBots,
    },
  });
}
