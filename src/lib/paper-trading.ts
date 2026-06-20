import { prisma } from "./db";
import { getPrice } from "./binance";

export interface PaperTradeResult {
  success: boolean;
  message: string;
  trade?: {
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    total: number;
  };
  newBalance?: number;
}

export async function executePaperTrade(
  userId: string,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number
): Promise<PaperTradeResult> {
  const price = await getPrice(symbol);
  const total = price * quantity;
  const fee = total * 0.001; // 0.1% fee

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, message: "User not found" };

  if (side === "BUY") {
    const cost = total + fee;
    if (user.paperBalance < cost) {
      return {
        success: false,
        message: `Insufficient paper balance. Need $${cost.toFixed(2)}, have $${user.paperBalance.toFixed(2)}`,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { paperBalance: user.paperBalance - cost },
    });
  } else {
    // For SELL, calculate PnL from avg buy price
    const buys = await prisma.paperTrade.findMany({
      where: { userId, symbol, side: "BUY" },
      orderBy: { createdAt: "desc" },
    });
    const avgBuyPrice =
      buys.length > 0
        ? buys.reduce((sum: number, t: { price: number }) => sum + t.price, 0) / buys.length
        : price;

    const revenue = total - fee;
    const pnl = (price - avgBuyPrice) * quantity;

    await prisma.user.update({
      where: { id: userId },
      data: { paperBalance: user.paperBalance + revenue },
    });

    await prisma.paperTrade.create({
      data: {
        userId,
        symbol,
        side: "SELL",
        quantity,
        price,
        total,
        pnl,
        status: "FILLED",
      },
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    return {
      success: true,
      message: `Paper SELL executed at $${price.toFixed(2)}`,
      trade: { symbol, side, quantity, price, total },
      newBalance: updatedUser?.paperBalance,
    };
  }

  await prisma.paperTrade.create({
    data: {
      userId,
      symbol,
      side: "BUY",
      quantity,
      price,
      total,
      pnl: 0,
      status: "FILLED",
    },
  });

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  return {
    success: true,
    message: `Paper BUY executed at $${price.toFixed(2)}`,
    trade: { symbol, side, quantity, price, total },
    newBalance: updatedUser?.paperBalance,
  };
}

export async function getPaperPortfolio(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const trades = await prisma.paperTrade.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Calculate holdings
  const holdings: Record<string, { quantity: number; avgPrice: number }> = {};

  for (const trade of [...trades].reverse()) {
    if (trade.side === "BUY") {
      if (!holdings[trade.symbol]) {
        holdings[trade.symbol] = { quantity: 0, avgPrice: 0 };
      }
      const existing = holdings[trade.symbol];
      const totalQty = existing.quantity + trade.quantity;
      existing.avgPrice =
        (existing.avgPrice * existing.quantity + trade.price * trade.quantity) /
        totalQty;
      existing.quantity = totalQty;
    } else {
      if (holdings[trade.symbol]) {
        holdings[trade.symbol].quantity -= trade.quantity;
        if (holdings[trade.symbol].quantity <= 0) {
          delete holdings[trade.symbol];
        }
      }
    }
  }

  return {
    cashBalance: user?.paperBalance ?? 10000,
    holdings,
    trades: trades.slice(0, 20),
  };
}
