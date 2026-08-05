// PSX (Pakistan Stock Exchange) price data via Yahoo Finance.
// Symbols use the ".KA" suffix for the Karachi exchange, e.g. "EFERT.KA".
import axios from "axios";

interface YahooChartResult {
  meta: {
    regularMarketPrice: number;
    regularMarketTime?: number;
    previousClose?: number;
    regularMarketChangePercent?: number;
    regularMarketChange?: number;
    currency?: string;
  };
  timestamp: number[];
  indicators: { quote: [{ close: (number | null)[] }] };
}

export interface PricePoint {
  time: number; // unix seconds
  close: number;
}

export interface PsxQuote {
  closes: number[];
  history: PricePoint[]; // closes with their trading-day timestamp, same filtering, same order
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

  const history: PricePoint[] = [];
  rawCloses.forEach((c, i) => {
    if (c !== null && !isNaN(c) && result.timestamp[i] != null) {
      history.push({ time: result.timestamp[i], close: c });
    }
  });

  const closes = history.map((h) => h.close);

  // For some thinly-traded PSX tickers, Yahoo's "live" quote (regularMarketPrice)
  // goes stale for months while the historical daily-close series keeps updating
  // normally — seen on FFC.KA, where regularMarketTime was frozen ~2 years in the
  // past. Trust whichever of the two is actually more recent.
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const quoteIsStale = last && last.time > (result.meta.regularMarketTime ?? 0);

  const price = quoteIsStale ? last.close : result.meta.regularMarketPrice;
  // Yahoo Finance returns regularMarketChangePercent as a percentage value (e.g. 1.5 = +1.5%)
  const change1d = quoteIsStale
    ? (prev ? ((last.close - prev.close) / prev.close) * 100 : 0)
    : (result.meta.regularMarketChangePercent ?? 0);

  return { closes, history, price, change1d };
}
