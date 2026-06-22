// Multi-source market data aggregator
// Sources: CoinGecko (OHLCV/market), Alternative.me (Fear & Greed), CryptoPanic (news sentiment)

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
