import { NextRequest } from "next/server";
import { getKlinesBybit, getKlinesCG } from "@/lib/market-data";
import { analyzeSignals } from "@/lib/signals";
import { CRYPTO_ASSETS, COMMODITY_ASSETS, FOREX_ASSETS, type AssetCategory } from "@/lib/market-signals-types";
import axios from "axios";

export type { AssetCategory } from "@/lib/market-signals-types";
export { CRYPTO_ASSETS, COMMODITY_ASSETS, FOREX_ASSETS };

interface YahooChartResult {
  meta: { regularMarketPrice: number; previousClose?: number };
  timestamp: number[];
  indicators: { quote: [{ close: (number | null)[] }] };
}

async function fetchYahooCloses(symbol: string): Promise<{ closes: number[]; price: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const { data } = await axios.get<{ chart: { result: YahooChartResult[] | null; error?: { description: string } } }>(
    url,
    {
      params: { interval: "1d", range: "6mo" },
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    }
  );

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(data?.chart?.error?.description ?? "No data from Yahoo Finance");

  const rawCloses = result.indicators.quote[0].close;
  const closes = rawCloses.filter((c): c is number => c !== null && !isNaN(c));
  const price = result.meta.regularMarketPrice;

  return { closes, price };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get("symbol") ?? "BTCUSDT";
  const category = (searchParams.get("category") ?? "crypto") as AssetCategory;
  const interval = searchParams.get("interval") ?? "1d";

  try {
    let closes: number[];
    let price: number;

    if (category === "crypto") {
      // Try Bybit first (no geo-block, 120 req/min) → fallback CoinGecko
      let klines;
      try {
        klines = await getKlinesBybit(symbol, "1d", 200);
      } catch {
        klines = await getKlinesCG(symbol, "1d", 100);
      }
      closes = klines.map((k) => k.close);
      price  = klines[klines.length - 1].close;
    } else {
      const result = await fetchYahooCloses(symbol);
      closes = result.closes;
      price  = result.price;
    }

    const signal = analyzeSignals(closes);

    return Response.json({ symbol, category, interval, signal, price, timestamp: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch market data";
    return Response.json({ error: msg }, { status: 500 });
  }
}
