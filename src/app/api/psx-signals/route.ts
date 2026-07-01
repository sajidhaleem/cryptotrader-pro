import { NextRequest } from "next/server";
import { analyzeSignals } from "@/lib/signals";
import { PSX_ASSETS } from "@/lib/psx-types";
import axios from "axios";

interface YahooChartResult {
  meta: {
    regularMarketPrice: number;
    previousClose?: number;
    regularMarketChangePercent?: number;
    regularMarketChange?: number;
    currency?: string;
  };
  timestamp: number[];
  indicators: { quote: [{ close: (number | null)[] }] };
}

async function fetchYahooData(symbol: string): Promise<{ closes: number[]; price: number; change1d: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const { data } = await axios.get<{ chart: { result: YahooChartResult[] | null; error?: { description: string } } }>(
    url,
    {
      params: { interval: "1d", range: "6mo" },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      timeout: 12000,
    }
  );

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(data?.chart?.error?.description ?? `No data for ${symbol}`);

  const rawCloses = result.indicators.quote[0].close;
  const closes = rawCloses.filter((c): c is number => c !== null && !isNaN(c));
  const price = result.meta.regularMarketPrice;

  // Yahoo Finance returns regularMarketChangePercent as a percentage value (e.g. 1.5 = +1.5%)
  const change1d = result.meta.regularMarketChangePercent ?? 0;

  return { closes, price, change1d };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "HBL.KA";

  const asset = PSX_ASSETS.find(a => a.symbol === symbol);

  try {
    const { closes, price, change1d } = await fetchYahooData(symbol);
    const signal = analyzeSignals(closes);

    return Response.json({
      symbol,
      label: asset?.label ?? symbol,
      sector: asset?.sector ?? "Other",
      price,
      change1d,
      signal,
      timestamp: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch PSX data";
    return Response.json({ error: msg }, { status: 500 });
  }
}
