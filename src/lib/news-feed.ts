// Financial news aggregator — RSS feeds from Reuters, Yahoo Finance, MarketWatch, CoinDesk
// Provides news context for AI bot recommendations
import axios from "axios";

export interface NewsContext {
  headlines: string[];          // raw titles, most recent first
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  sentimentScore: number;       // -1.0 (fully bearish) to +1.0 (fully bullish)
  bullishCount: number;
  bearishCount: number;
  sources: string[];            // which feeds contributed
}

const BULLISH_WORDS = [
  "surge", "rally", "bullish", "gain", "rise", "soar", "breakout", "recovery",
  "outperform", "upgrade", "beats expectations", "strong demand", "record", "growth",
  "optimism", "inflows", "buyers", "tops", "climbs", "rebounds", "advances", "higher",
  "buying", "positive", "boosts", "up", "green", "profit", "interest buying",
];

const BEARISH_WORDS = [
  "crash", "plunge", "bearish", "decline", "fall", "selloff", "correction", "fear",
  "warns", "cut", "miss", "weak", "recession", "concern", "slump", "outflows",
  "pressure", "risk-off", "hawkish", "inflation fears", "lower", "drops", "red",
  "loss", "selling", "retreat", "slides", "tumbles", "worsens", "struggle",
];

// Map our internal symbols → Yahoo Finance ticker for RSS headlines
const YAHOO_RSS_SYMBOL: Record<string, string> = {
  // Crypto
  BTCUSDT: "BTC-USD", ETHUSDT: "ETH-USD", BNBUSDT: "BNB-USD",
  SOLUSDT: "SOL-USD", XRPUSDT: "XRP-USD", ADAUSDT: "ADA-USD",
  DOGEUSDT: "DOGE-USD", AVAXUSDT: "AVAX-USD", DOTUSDT: "DOT-USD",
  LINKUSDT: "LINK-USD", MATICUSDT: "MATIC-USD", LTCUSDT: "LTC-USD",
  // Commodities — Yahoo Finance uses the futures symbol directly
  "GC=F": "GC=F", "SI=F": "SI=F", "CL=F": "CL=F", "NG=F": "NG=F",
  "HG=F": "HG=F", "PL=F": "PL=F", "ZW=F": "ZW=F", "ZC=F": "ZC=F",
  // Forex
  "EURUSD=X": "EURUSD=X", "GBPUSD=X": "GBPUSD=X", "JPY=X": "JPY=X",
  "CHF=X": "CHF=X", "AUDUSD=X": "AUDUSD=X", "CAD=X": "CAD=X",
  "NZDUSD=X": "NZDUSD=X", "EURGBP=X": "EURGBP=X",
};

// Extra context feeds (macro/market news)
const MACRO_FEEDS: { name: string; url: string; cryptoOnly?: boolean }[] = [
  {
    name: "Reuters Business",
    url: "https://feeds.reuters.com/reuters/businessNews",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
  },
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    cryptoOnly: true,
  },
];

function parseRssTitles(xml: string, max = 10): string[] {
  const titles: string[] = [];
  // Match both CDATA-wrapped and plain title elements inside <item> blocks
  const re = /<title[^>]*>(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?<\/title>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && titles.length < max) {
    const t = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    // Skip the channel-level <title> (site names are short and lack spaces)
    if (t.length > 25 && t.includes(" ")) {
      titles.push(t);
    }
  }
  return titles;
}

function scoreSentiment(headlines: string[]): { score: number; bull: number; bear: number } {
  let bull = 0, bear = 0;
  for (const h of headlines) {
    const lower = h.toLowerCase();
    const b = BULLISH_WORDS.filter(w => lower.includes(w)).length;
    const s = BEARISH_WORDS.filter(w => lower.includes(w)).length;
    if (b > s) bull++;
    else if (s > b) bear++;
  }
  const total = bull + bear;
  return { score: total > 0 ? (bull - bear) / total : 0, bull, bear };
}

export async function fetchNewsContext(
  symbol: string,
  category: "crypto" | "commodity" | "forex" = "crypto"
): Promise<NewsContext> {
  const yahooTicker = YAHOO_RSS_SYMBOL[symbol] ?? symbol;
  const allHeadlines: string[] = [];
  const usedSources: string[] = [];
  const isCrypto = category === "crypto";

  // ── 1. Yahoo Finance per-symbol RSS (most targeted & reliable) ─────────────
  try {
    const url = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(yahooTicker)}`;
    const { data } = await axios.get<string>(url, {
      timeout: 7000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    const titles = parseRssTitles(data, 10);
    if (titles.length > 0) {
      allHeadlines.push(...titles);
      usedSources.push("Yahoo Finance");
    }
  } catch { /* not fatal — continue to fallbacks */ }

  // ── 2. Macro context feeds ──────────────────────────────────────────────────
  for (const feed of MACRO_FEEDS) {
    if (allHeadlines.length >= 14) break;
    if (feed.cryptoOnly && !isCrypto) continue;
    try {
      const { data } = await axios.get<string>(feed.url, {
        timeout: 5000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const titles = parseRssTitles(data, 4);
      if (titles.length > 0) {
        allHeadlines.push(...titles);
        usedSources.push(feed.name);
      }
    } catch { /* skip — not fatal */ }
  }

  const deduped = [...new Set(allHeadlines)].slice(0, 12);
  const { score, bull, bear } = scoreSentiment(deduped);

  return {
    headlines: deduped,
    sentiment: score > 0.15 ? "BULLISH" : score < -0.15 ? "BEARISH" : "NEUTRAL",
    sentimentScore: Math.round(score * 100) / 100,
    bullishCount: bull,
    bearishCount: bear,
    sources: [...new Set(usedSources)],
  };
}
