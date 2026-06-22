// Claude-powered bot strategy advisor
// Market data via CoinGecko (Binance public endpoints return 451 from US-hosted servers)
// Trading execution still uses Binance via user's own API keys
import Anthropic from "@anthropic-ai/sdk";
import { RSI, BollingerBands, MACD, ADX } from "technicalindicators";
import axios from "axios";
import { COINGECKO_IDS } from "./market-data";

export interface BotRecommendation {
  strategy: "DCA" | "RSI" | "MACD" | "GRID";
  name: string;
  symbol: string;
  config: Record<string, unknown>;
  rationale: string;
  marketPhase: "RANGING" | "TRENDING_UP" | "TRENDING_DOWN" | "VOLATILE" | "ACCUMULATION";
  confidence: number;
  safetyNotes: string[];
  rawMarketData: MarketSnapshot;
}

export interface MarketSnapshot {
  price: number;
  adx: number;
  rsi1h: number;
  rsi4h: number;
  bbWidth: number;
  bbPosition: number;
  macdHistogram: number;
  macdBullish: boolean;
  volumeRatio: number;
  change24h: number;
}

const CG = "https://api.coingecko.com/api/v3";

async function buildMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) throw new Error(`Unsupported symbol: ${symbol}. Supported: ${Object.keys(COINGECKO_IDS).join(", ")}`);

  const [chart1h, ohlc4h, priceData] = await Promise.all([
    // ~120 hourly close prices + volumes (5 days × 24h)
    axios.get<{ prices: [number, number][]; total_volumes: [number, number][] }>(
      `${CG}/coins/${coinId}/market_chart`,
      { params: { vs_currency: "usd", days: 5, interval: "hourly" } }
    ),
    // ~42 OHLCV candles at 4H resolution (7 days × 6 candles/day)
    axios.get<[number, number, number, number, number][]>(
      `${CG}/coins/${coinId}/ohlc`,
      { params: { vs_currency: "usd", days: 7 } }
    ),
    // Current price + 24h change
    axios.get<Record<string, { usd: number; usd_24h_change: number }>>(
      `${CG}/simple/price`,
      { params: { ids: coinId, vs_currencies: "usd", include_24hr_change: true } }
    ),
  ]);

  const closes1h  = chart1h.data.prices.map(([, p]) => p);
  const volumes1h = chart1h.data.total_volumes.map(([, v]) => v);

  const ohlcData  = ohlc4h.data; // [timestamp, open, high, low, close]
  const closes4h  = ohlcData.map(c => c[4]);
  const highs4h   = ohlcData.map(c => c[2]);
  const lows4h    = ohlcData.map(c => c[3]);

  const coinInfo  = priceData.data[coinId];
  const currentPrice = coinInfo.usd;
  const change24h    = coinInfo.usd_24h_change;

  // RSI — 1H and 4H
  const rsiArr1h = RSI.calculate({ period: 14, values: closes1h });
  const rsiArr4h = RSI.calculate({ period: 14, values: closes4h });
  const rsi1h = rsiArr1h[rsiArr1h.length - 1] ?? 50;
  const rsi4h = rsiArr4h[rsiArr4h.length - 1] ?? 50;

  // Bollinger Bands width + position (1H)
  const bbArr = BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 });
  const bb = bbArr[bbArr.length - 1];
  const bbWidth    = bb ? (bb.upper - bb.lower) / bb.middle : 0.02;
  const bbPosition = bb && bb.upper !== bb.lower
    ? (currentPrice - bb.lower) / (bb.upper - bb.lower)
    : 0.5;

  // MACD histogram direction (4H)
  const macdArr = MACD.calculate({
    values: closes4h, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  const macdLast     = macdArr[macdArr.length - 1];
  const macdPrev     = macdArr[macdArr.length - 2];
  const macdHistogram = macdLast?.histogram ?? 0;
  const macdBullish   = (macdHistogram > 0) || ((macdPrev?.histogram ?? 0) < 0 && macdHistogram >= 0);

  // ADX trend strength (4H) — needs high/low/close
  let adxValue = 20;
  try {
    const adxArr = ADX.calculate({ period: 14, high: highs4h, low: lows4h, close: closes4h });
    adxValue = adxArr[adxArr.length - 1]?.adx ?? 20;
  } catch { /* keep default 20 (weak/no trend) */ }

  // Volume surge vs 24h baseline
  const recentVol  = volumes1h.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const baselineVol = volumes1h.slice(-24, -3).reduce((s, v) => s + v, 0) / 21;
  const volumeRatio = baselineVol > 0 ? recentVol / baselineVol : 1;

  return {
    price: currentPrice,
    adx: adxValue,
    rsi1h,
    rsi4h,
    bbWidth,
    bbPosition,
    macdHistogram,
    macdBullish,
    volumeRatio,
    change24h,
  };
}

function describeMarket(snap: MarketSnapshot): string {
  const adxLabel =
    snap.adx < 18 ? "RANGING (no trend)" :
    snap.adx < 25 ? "WEAK TREND" :
    snap.adx < 35 ? "MODERATE TREND" : "STRONG TREND";

  const rsi1hLabel =
    snap.rsi1h < 30 ? "OVERSOLD" : snap.rsi1h > 70 ? "OVERBOUGHT" : "NEUTRAL";
  const rsi4hLabel =
    snap.rsi4h < 30 ? "OVERSOLD" : snap.rsi4h > 70 ? "OVERBOUGHT" : "NEUTRAL";
  const bbLabel =
    snap.bbWidth < 0.015 ? "SQUEEZE (breakout imminent)" :
    snap.bbWidth > 0.05  ? "EXPANDED (high volatility)" : "NORMAL";
  const macdLabel = snap.macdBullish ? "BULLISH" : "BEARISH";
  const volLabel =
    snap.volumeRatio > 2   ? "SURGE (strong conviction)" :
    snap.volumeRatio < 0.5 ? "DRY (weak conviction)" : "NORMAL";

  return [
    `Price: $${snap.price.toFixed(2)} (24h: ${snap.change24h > 0 ? "+" : ""}${snap.change24h.toFixed(2)}%)`,
    `ADX (4H): ${snap.adx.toFixed(1)} — ${adxLabel}`,
    `RSI 1H: ${snap.rsi1h.toFixed(1)} — ${rsi1hLabel}`,
    `RSI 4H: ${snap.rsi4h.toFixed(1)} — ${rsi4hLabel}`,
    `BB Width (1H): ${(snap.bbWidth * 100).toFixed(2)}% — ${bbLabel}`,
    `BB Position: ${(snap.bbPosition * 100).toFixed(0)}% (0=lower band, 100=upper band)`,
    `MACD (4H): ${snap.macdHistogram > 0 ? "+" : ""}${snap.macdHistogram.toFixed(4)} — ${macdLabel}`,
    `Volume vs 24h avg: ${snap.volumeRatio.toFixed(2)}x — ${volLabel}`,
  ].join("\n");
}

export async function getBotRecommendation(symbol: string): Promise<BotRecommendation> {
  const snap = await buildMarketSnapshot(symbol);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured — add it to Netlify environment variables");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are an expert algorithmic crypto trader and bot strategy architect specializing in Binance automated trading. You analyze real-time technical indicators and recommend the single best bot configuration that will profit from current conditions while remaining completely safe from Binance account restrictions.

## Strategy Selection Rules

**GRID bot** — choose when:
- ADX < 22 (market is ranging, no clear trend)
- BB width between 1.5% and 5% (price oscillating in a defined range)
- Grid range: current price ±10-15% based on recent support/resistance
- Grid levels: 6-12 (fewer = larger gaps between orders = safer)
- Minimum $1500 spacing per grid level for BTC, $30 for altcoins

**MACD bot** — choose when:
- ADX > 25 (trending market, momentum is real)
- MACD histogram is positive and rising (confirms direction)
- Interval: always 4h (cleanest signals, less noise than 1h)

**RSI bot** — choose when:
- RSI regularly dips below 35 on 1H or 4H (asset has defined oscillation pattern)
- Market is sideways-to-bullish (not a strong downtrend)
- rsiLow: 32-35 (wider than traditional 30 to catch crypto's faster moves)
- rsiHigh: 65-68 (exit sooner in crypto due to fast reversals)
- Interval: 4h preferred (reduces false signals)

**DCA bot** — choose when:
- No clear pattern for other bots (ADX 20-25, normal BB, mixed MACD)
- Strong long-term bullish asset (BTC/ETH) regardless of short-term
- User wants safest, most consistent accumulation
- Interval: 4h minimum (never shorter — preserves Binance account health)

## Binance Account Safety Requirements (NON-NEGOTIABLE)
- Minimum order amount: $15 USDT (Binance enforces $10 min; $15 gives safety margin)
- No interval shorter than 1h for any bot (30m only for DCA on major pairs)
- Grid spacing must ensure orders don't fill within seconds of each other
- Never recommend config that would generate >10 orders per hour
- MARKET orders only (already enforced in code)

Respond ONLY with valid JSON — no explanation outside the JSON, no markdown code fences.`;

  const userMessage = `Analyze ${symbol} market conditions and recommend the optimal bot:

${describeMarket(snap)}

Provide your recommendation as JSON:
{
  "strategy": "DCA" | "RSI" | "MACD" | "GRID",
  "name": "<descriptive name max 28 chars>",
  "config": {
    <strategy-specific fields — see rules above>
  },
  "rationale": "<2-3 sentences: why this strategy NOW, what market condition makes it optimal, expected behavior>",
  "marketPhase": "RANGING" | "TRENDING_UP" | "TRENDING_DOWN" | "VOLATILE" | "ACCUMULATION",
  "confidence": <50-92>,
  "safetyNotes": ["<note 1>", "<note 2>", "<note 3>"]
}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  // Strip any accidental markdown fences
  let text = content.text.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) text = fenceMatch[1].trim();

  const parsed = JSON.parse(text) as Omit<BotRecommendation, "symbol" | "rawMarketData">;

  // Enforce minimum safety thresholds — never trust the model alone
  const cfg = parsed.config as Record<string, unknown>;
  if (typeof cfg.amount === "number" && cfg.amount < 15) cfg.amount = 15;
  if (cfg.interval === "30m" && parsed.strategy !== "DCA") cfg.interval = "1h";

  return { ...parsed, symbol, rawMarketData: snap };
}
