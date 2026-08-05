// PSX (Pakistan Stock Exchange) price data via Yahoo Finance.
// Symbols use the ".KA" suffix for the Karachi exchange, e.g. "EFERT.KA".
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

export interface PsxQuote {
  closes: number[];
  price: number;
  change1d: number;
}

export async function fetchPsxQuote(symbol: string): Promise<PsxQuote> {
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

  const rawCloses = result.indicators?.quote?.[0]?.close;
  if (!rawCloses || !result.meta) throw new Error(`Incomplete data for ${symbol}`);

  const closes = rawCloses.filter((c): c is number => c !== null && !isNaN(c));
  const price = result.meta.regularMarketPrice;

  // Yahoo Finance returns regularMarketChangePercent as a percentage value (e.g. 1.5 = +1.5%)
  const change1d = result.meta.regularMarketChangePercent ?? 0;

  return { closes, price, change1d };
}
