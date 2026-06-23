// Multi-source market data aggregator
// Sources: CoinGecko (OHLCV/market), Alternative.me (Fear & Greed), CryptoPanic (news sentiment)
// NOTE: All server-side Binance public API calls return 451 from US-hosted servers (Netlify).
//       Functions below (getPriceCG, getKlinesCG, etc.) are used as drop-in replacements.
import axios from "axios";
import type { Kline } from "./binance";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1";
const CRYPTOPANIC_BASE = "https://cryptopanic.com/api/v1/posts";

// Map Binance symbols to CoinGecko IDs
const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  BNBUSDT: "binancecoin",
  SOLUSDT: "solana",
  ADAUSDT: "cardano",
  XRPUSDT: "ripple",
  DOTUSDT: "polkadot",
  LINKUSDT: "chainlink",
  AVAXUSDT: "avalanche-2",
  MATICUSDT: "matic-network",
  DOGEUSDT: "dogecoin",
  LTCUSDT: "litecoin",
};

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChangePercent: number;
  priceHistory: number[]; // last 90 daily closes for indicators
}

export interface FearGreedData {
  value: number;        // 0-100
  classification: string; // Extreme Fear / Fear / Neutral / Greed / Extreme Greed
}

export interface NewsItem {
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  publishedAt: string;
  url: string;
}

export async function getMarketData(symbol: string): Promise<MarketData | null> {
  const coinId = SYMBOL_MAP[symbol];
  if (!coinId) return null;

  try {
    const [coin, history] = await Promise.all([
      fetch(`${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`, {
        next: { revalidate: 300 },
      }).then((r) => r.json()),
      fetch(`${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`, {
        next: { revalidate: 3600 },
      }).then((r) => r.json()),
    ]);

    const priceHistory: number[] = (history.prices ?? []).map(([, p]: [number, number]) => p);

    return {
      symbol,
      price: coin.market_data?.current_price?.usd ?? 0,
      change24h: coin.market_data?.price_change_percentage_24h ?? 0,
      volume24h: coin.market_data?.total_volume?.usd ?? 0,
      marketCap: coin.market_data?.market_cap?.usd ?? 0,
      high24h: coin.market_data?.high_24h?.usd ?? 0,
      low24h: coin.market_data?.low_24h?.usd ?? 0,
      ath: coin.market_data?.ath?.usd ?? 0,
      athChangePercent: coin.market_data?.ath_change_percentage?.usd ?? 0,
      priceHistory,
    };
  } catch {
    return null;
  }
}

export async function getFearGreedIndex(): Promise<FearGreedData> {
  try {
    const data = await fetch(FEAR_GREED_URL, { next: { revalidate: 3600 } }).then((r) => r.json());
    const entry = data?.data?.[0];
    return {
      value: Number(entry?.value ?? 50),
      classification: entry?.value_classification ?? "Neutral",
    };
  } catch {
    return { value: 50, classification: "Neutral" };
  }
}

export async function getNewsSentiment(symbol: string): Promise<{ score: number; items: NewsItem[] }> {
  const currency = symbol.replace("USDT", "");
  try {
    const url = `${CRYPTOPANIC_BASE}/?auth_token=free&currencies=${currency}&kind=news&filter=hot&public=true`;
    const data = await fetch(url, { next: { revalidate: 900 } }).then((r) => r.json());

    const items: NewsItem[] = (data?.results ?? []).slice(0, 10).map((post: {
      title: string;
      votes?: { positive?: number; negative?: number };
      published_at: string;
      url: string;
    }) => {
      const pos = post.votes?.positive ?? 0;
      const neg = post.votes?.negative ?? 0;
      const total = pos + neg;
      const sentiment: "positive" | "negative" | "neutral" =
        total === 0 ? "neutral" : pos / total > 0.6 ? "positive" : neg / total > 0.6 ? "negative" : "neutral";
      return { title: post.title, sentiment, publishedAt: post.published_at, url: post.url };
    });

    const positiveCount = items.filter((i) => i.sentiment === "positive").length;
    const negativeCount = items.filter((i) => i.sentiment === "negative").length;
    const total = items.length || 1;
    const score = (positiveCount - negativeCount) / total; // -1 to 1

    return { score, items };
  } catch {
    return { score: 0, items: [] };
  }
}

// Volume trend: compare current 24h volume vs 7-day average from CoinGecko
export async function getVolumeTrend(symbol: string): Promise<{ ratio: number; trend: "INCREASING" | "DECREASING" | "STABLE" }> {
  const coinId = SYMBOL_MAP[symbol];
  if (!coinId) return { ratio: 1, trend: "STABLE" };

  try {
    const data = await fetch(
      `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`,
      { next: { revalidate: 3600 } }
    ).then((r) => r.json());

    const volumes: number[] = (data?.total_volumes ?? []).map(([, v]: [number, number]) => v);
    if (volumes.length < 2) return { ratio: 1, trend: "STABLE" };

    const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
    const currentVolume = volumes[volumes.length - 1];
    const ratio = currentVolume / avgVolume;

    return {
      ratio,
      trend: ratio > 1.2 ? "INCREASING" : ratio < 0.8 ? "DECREASING" : "STABLE",
    };
  } catch {
    return { ratio: 1, trend: "STABLE" };
  }
}

// ─── Drop-in replacements for Binance public API (geo-blocked on US servers) ───

export const COINGECKO_IDS = SYMBOL_MAP;

function cgId(symbol: string): string {
  const id = SYMBOL_MAP[symbol];
  if (!id) throw new Error(`Unsupported symbol: ${symbol}`);
  return id;
}

export async function getPriceCG(symbol: string): Promise<number> {
  const id = cgId(symbol);
  const { data } = await axios.get<Record<string, { usd: number }>>(
    `${COINGECKO_BASE}/simple/price`,
    { params: { ids: id, vs_currencies: "usd" } }
  );
  return data[id].usd;
}

export async function getPricesCG(symbols: string[]): Promise<Record<string, number>> {
  const valid = symbols.filter(s => SYMBOL_MAP[s]);
  const ids = valid.map(s => SYMBOL_MAP[s]).join(",");
  const { data } = await axios.get<Record<string, { usd: number }>>(
    `${COINGECKO_BASE}/simple/price`,
    { params: { ids, vs_currencies: "usd" } }
  );
  const result: Record<string, number> = {};
  valid.forEach(sym => {
    const id = SYMBOL_MAP[sym];
    if (data[id]) result[sym] = data[id].usd;
  });
  return result;
}

export async function get24hrStatsCG(symbol: string) {
  const id = cgId(symbol);
  const { data } = await axios.get<Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number }>>(
    `${COINGECKO_BASE}/simple/price`,
    { params: { ids: id, vs_currencies: "usd", include_24hr_change: true, include_24hr_vol: true } }
  );
  const d = data[id];
  return {
    symbol,
    price: d.usd,
    priceChange: d.usd * (d.usd_24h_change / 100),
    priceChangePercent: d.usd_24h_change,
    volume: d.usd_24h_vol / d.usd,
    quoteVolume: d.usd_24h_vol,
    high: d.usd * 1.01,
    low: d.usd * 0.99,
  };
}

export async function get24hrStatsBatchCG(
  symbols: string[]
): Promise<Record<string, { price: number; priceChangePercent: number }>> {
  const valid = symbols.filter(s => SYMBOL_MAP[s]);
  const ids = valid.map(s => SYMBOL_MAP[s]).join(",");
  const { data } = await axios.get<Record<string, { usd: number; usd_24h_change: number }>>(
    `${COINGECKO_BASE}/simple/price`,
    { params: { ids, vs_currencies: "usd", include_24hr_change: true } }
  );
  const result: Record<string, { price: number; priceChangePercent: number }> = {};
  valid.forEach(sym => {
    const id = SYMBOL_MAP[sym];
    if (data[id]) result[sym] = { price: data[id].usd, priceChangePercent: data[id].usd_24h_change };
  });
  return result;
}

// Returns Kline-compatible array using CoinGecko.
// 4H/1D: uses ohlc endpoint (real high/low, needed for ADX).
// 1H/30m: uses market_chart hourly (high/low estimated from adjacent closes).
// 1W/1M: fetches daily closes and resamples into weekly/monthly candles (up to 5 years).
export async function getKlinesCG(symbol: string, interval: string, limit: number): Promise<Kline[]> {
  const id = cgId(symbol);

  if (interval === "1w" || interval === "1M") {
    const days = interval === "1w" ? Math.min(limit * 7 + 14, 1825) : Math.min(limit * 31 + 31, 1825);
    const { data } = await axios.get<{ prices: [number, number][]; total_volumes: [number, number][] }>(
      `${COINGECKO_BASE}/coins/${id}/market_chart`,
      { params: { vs_currency: "usd", days } }
    );

    const groups = new Map<string, { timestamps: number[]; prices: number[]; volumes: number[] }>();
    data.prices.forEach(([t, p], i) => {
      const date = new Date(t);
      let key: string;
      if (interval === "1w") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
      if (!groups.has(key)) groups.set(key, { timestamps: [], prices: [], volumes: [] });
      const g = groups.get(key)!;
      g.timestamps.push(t);
      g.prices.push(p);
      g.volumes.push(data.total_volumes[i]?.[1] ?? 0);
    });

    const klines: Kline[] = [];
    for (const [, g] of groups) {
      if (g.prices.length === 0) continue;
      klines.push({
        openTime: g.timestamps[0],
        open: g.prices[0],
        high: Math.max(...g.prices),
        low: Math.min(...g.prices),
        close: g.prices[g.prices.length - 1],
        volume: g.volumes.reduce((a, b) => a + b, 0),
        closeTime: g.timestamps[g.timestamps.length - 1],
      });
    }
    return klines.slice(-limit);
  }

  if (interval === "4h" || interval === "12h") {
    const days = limit > 42 ? 14 : 7;
    const { data } = await axios.get<[number, number, number, number, number][]>(
      `${COINGECKO_BASE}/coins/${id}/ohlc`,
      { params: { vs_currency: "usd", days } }
    );
    return data.slice(-limit).map(([t, o, h, l, c]) => ({
      openTime: t - 4 * 3600e3,
      open: o, high: h, low: l, close: c,
      volume: 0,
      closeTime: t - 1,
    }));
  }

  if (interval === "1d" || interval === "24h") {
    const days = Math.max(limit + 10, 90);
    const { data } = await axios.get<[number, number, number, number, number][]>(
      `${COINGECKO_BASE}/coins/${id}/ohlc`,
      { params: { vs_currency: "usd", days } }
    );
    return data.slice(-limit).map(([t, o, h, l, c]) => ({
      openTime: t - 86400e3,
      open: o, high: h, low: l, close: c,
      volume: 0,
      closeTime: t - 1,
    }));
  }

  // 1h / 30m — hourly market_chart
  const days = Math.min(Math.ceil(limit / 24) + 2, 90);
  const { data } = await axios.get<{ prices: [number, number][]; total_volumes: [number, number][] }>(
    `${COINGECKO_BASE}/coins/${id}/market_chart`,
    { params: { vs_currency: "usd", days, interval: "hourly" } }
  );
  const prices  = data.prices.slice(-limit);
  const volumes = data.total_volumes.slice(-limit);
  return prices.map(([t, c], i) => {
    const prev = i > 0 ? prices[i - 1][1] : c;
    return {
      openTime: t - 3600e3,
      open: prev,
      high: Math.max(c, prev),
      low: Math.min(c, prev),
      close: c,
      volume: volumes[i]?.[1] ?? 0,
      closeTime: t - 1,
    };
  });
}
