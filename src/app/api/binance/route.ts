import { NextRequest } from "next/server";
import { get24hrStats, getKlines, getPrices, getOrderBook, POPULAR_PAIRS } from "@/lib/binance";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";
  const interval = searchParams.get("interval") ?? "1h";

  try {
    switch (action) {
      case "prices": {
        const prices = await getPrices(POPULAR_PAIRS);
        return Response.json({ prices });
      }
      case "ticker": {
        const stats = await get24hrStats(symbol);
        return Response.json({ stats });
      }
      case "klines": {
        const klines = await getKlines(symbol, interval, 100);
        return Response.json({ klines });
      }
      case "orderbook": {
        const orderBook = await getOrderBook(symbol, 10);
        return Response.json({ orderBook });
      }
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Binance API error:", err);
    return Response.json({ error: "Failed to fetch data from Binance" }, { status: 500 });
  }
}
