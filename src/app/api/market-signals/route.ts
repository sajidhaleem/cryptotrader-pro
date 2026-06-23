import { NextRequest } from "next/server";
import { getKlinesCG } from "@/lib/market-data";
import { analyzeSignals } from "@/lib/signals";
import axios from "axios";

export type AssetCategory = "crypto" | "commodity" | "forex";

export const CRYPTO_ASSETS = [
  { symbol: "BTCUSDT",  label: "Bitcoin",        short: "BTC"  },
  { symbol: "ETHUSDT",  label: "Ethereum",       short: "ETH"  },
  { symbol: "BNBUSDT",  label: "BNB",            short: "BNB"  },
  { symbol: "SOLUSDT",  label: "Solana",         short: "SOL"  },
  { symbol: "XRPUSDT",  label: "XRP",            short: "XRP"  },
  { symbol: "ADAUSDT",  label: "Cardano",        short: "ADA"  },
  { symbol: "DOGEUSDT", label: "Dogecoin",       short: "DOGE" },
  { symbol: "AVAXUSDT", label: "Avalanche",      short: "AVAX" },
  { symbol: "DOTUSDT",  label: "Polkadot",       short: "DOT"  },
  { symbol: "LINKUSDT", label: "Chainlink",      short: "LINK" },
];

export const COMMODITY_ASSETS = [
  { symbol: "GC=F",  label: "Gold",         short: "GOLD", unit: "$/oz"  },
  { symbol: "SI=F",  label: "Silver",       short: "SLVR", unit: "$/oz"  },
  { symbol: "CL=F",  label: "Crude Oil",    short: "OIL",  unit: "$/bbl" },
  { symbol: "NG=F",  label: "Natural Gas",  short: "NGAS", unit: "$/MMBtu" },
  { symbol: "HG=F",  label: "Copper",       short: "COPR", unit: "$/lb"  },
  { symbol: "PL=F",  label: "Platinum",     short: "PLAT", unit: "$/oz"  },
  { symbol: "ZW=F",  label: "Wheat",        short: "WHET", unit: "$/bu"  },
  { symbol: "ZC=F",  label: "Corn",         short: "CORN", unit: "$/bu"  },
];

export const FOREX_ASSETS = [
  { symbol: "EURUSD=X", label: "EUR / USD", short: "EURUSD" },
  { symbol: "GBPUSD=X", label: "GBP / USD", short: "GBPUSD" },
  { symbol: "JPY=X",    label: "USD / JPY", short: "USDJPY" },
  { symbol: "CHF=X",    label: "USD / CHF", short: "USDCHF" },
  { symbol: "AUDUSD=X", label: "AUD / USD", short: "AUDUSD" },
  { symbol: "CAD=X",    label: "USD / CAD", short: "USDCAD" },
  { symbol: "NZDUSD=X", label: "NZD / USD", short: "NZDUSD" },
  { symbol: "EURGBP=X", label: "EUR / GBP", short: "EURGBP" },
];

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
      const klines = await getKlinesCG(symbol, interval === "1d" ? "1d" : interval, 100);
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
