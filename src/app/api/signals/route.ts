import { NextRequest } from "next/server";
import { getKlines } from "@/lib/binance";
import { analyzeSignals } from "@/lib/signals";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";
  const interval = searchParams.get("interval") ?? "4h";

  try {
    const klines = await getKlines(symbol, interval, 100);
    const closes = klines.map((k) => k.close);
    const signal = analyzeSignals(closes);
    const latestKline = klines[klines.length - 1];

    return Response.json({
      symbol,
      interval,
      signal,
      price: latestKline.close,
      volume: latestKline.volume,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Signals error:", err);
    return Response.json({ error: "Failed to compute signals" }, { status: 500 });
  }
}
