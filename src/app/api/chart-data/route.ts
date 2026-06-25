import { NextRequest } from "next/server";
import { getKlinesCG } from "@/lib/market-data";
import { prisma, getOwnerId } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get("symbol")   ?? "BTCUSDT";
  const interval = searchParams.get("interval") ?? "4h";
  const type     = searchParams.get("type")     ?? "candles"; // "candles" | "pnl"

  try {
    if (type === "pnl") {
      // Cumulative P&L from paper trades ordered by date
      const userId = await getOwnerId();
      const trades = await prisma.paperTrade.findMany({
        where:   { userId, pnl: { not: undefined } },
        orderBy: { createdAt: "asc" },
        select:  { createdAt: true, pnl: true },
      });

      let cumulative = 0;
      const points = trades.map((t) => {
        cumulative += t.pnl ?? 0;
        return {
          time:  Math.floor(t.createdAt.getTime() / 1000) as number,
          value: parseFloat(cumulative.toFixed(2)),
        };
      });

      return Response.json({ points, total: parseFloat(cumulative.toFixed(2)) });
    }

    // Default: OHLCV candlestick data
    const klines = await getKlinesCG(symbol, interval, 120);
    const candles = klines.map((k) => ({
      time:  Math.floor(k.openTime / 1000) as number,
      open:  parseFloat(k.open.toFixed(6)),
      high:  parseFloat(k.high.toFixed(6)),
      low:   parseFloat(k.low.toFixed(6)),
      close: parseFloat(k.close.toFixed(6)),
    }));

    return Response.json({
      symbol,
      interval,
      candles,
      lastPrice: klines[klines.length - 1]?.close ?? 0,
    });
  } catch (err) {
    console.error("[chart-data]", err);
    return Response.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
