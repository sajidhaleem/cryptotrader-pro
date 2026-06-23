import { NextRequest } from "next/server";
import { getOrderBook, placeOrder, POPULAR_PAIRS } from "@/lib/binance";
import { getPricesCG, get24hrStatsCG, getKlinesCG } from "@/lib/market-data";
import { prisma, getOwnerId } from "@/lib/db";
import { decrypt } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";
  const interval = searchParams.get("interval") ?? "1h";

  try {
    switch (action) {
      case "prices": {
        const prices = await getPricesCG(POPULAR_PAIRS);
        return Response.json({ prices });
      }
      case "ticker": {
        const stats = await get24hrStatsCG(symbol);
        return Response.json({ stats });
      }
      case "klines": {
        const klines = await getKlinesCG(symbol, interval, 100);
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

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const encKey = process.env.ENCRYPTION_KEY ?? "";
  const { symbol, side, quantity } = await req.json() as { symbol: string; side: "BUY" | "SELL"; quantity: number };

  if (!symbol || !side || !quantity || quantity <= 0) {
    return Response.json({ error: "symbol, side, and quantity are required" }, { status: 400 });
  }

  const apiKeyRecord = await prisma.binanceApiKey.findFirst({
    where: { userId, isActive: true },
  });

  if (!apiKeyRecord) {
    return Response.json({ error: "No active Binance API key. Add one in Settings." }, { status: 400 });
  }

  try {
    const decryptedKey = decrypt(apiKeyRecord.apiKey, encKey);
    const decryptedSecret = decrypt(apiKeyRecord.secretKey, encKey);
    const order = await placeOrder(decryptedKey, decryptedSecret, symbol, side, quantity, apiKeyRecord.isTestnet);

    const fillPrice = order.fills && order.fills.length > 0 ? parseFloat(order.fills[0].price) : 0;
    await prisma.trade.create({
      data: {
        userId,
        symbol,
        side,
        quantity,
        price: fillPrice,
        total: fillPrice * quantity,
        orderId: String(order.orderId),
      },
    });

    return Response.json({ success: true, orderId: order.orderId, status: order.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Order placement failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
