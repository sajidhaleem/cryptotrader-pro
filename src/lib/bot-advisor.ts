// AI-powered bot & investment advisor — Claude (Anthropic) or NVIDIA NIM
// Technical data: CoinGecko (crypto) | Yahoo Finance (commodity/forex)
// News context: Yahoo Finance RSS, Reuters, MarketWatch, CoinDesk
import Anthropic from "@anthropic-ai/sdk";
import { callNIM, DEFAULT_NIM_MODEL, type NimModelId } from "./nvidia-nim";
import { callKimi, DEFAULT_KIMI_MODEL, type KimiModelId } from "./kimi";
import { RSI, BollingerBands, MACD, ADX } from "technicalindicators";
import axios from "axios";
import { COINGECKO_IDS, getKlinesBybit } from "./market-data";
import { fetchNewsContext, type NewsContext } from "./news-feed";

export type AssetCategory = "crypto" | "commodity" | "forex";

export interface BotRecommendation {
  strategy:    "DCA" | "RSI" | "MACD" | "GRID";
  name:        string;
  symbol:      string;
  category:    AssetCategory;
  config:      Record<string, unknown>;
  rationale:   string;
  // Investment levels — AI-estimated based on current price + ATR
  entryPrice:  number;
  stopLoss:    number;
  takeProfit:  number;
  riskReward:  number;
  action:      "BUY" | "SELL" | "HOLD";
  actionReason: string;
  marketPhase: "RANGING" | "TRENDING_UP" | "TRENDING_DOWN" | "VOLATILE" | "ACCUMULATION";
  confidence:  number;
  safetyNotes: string[];
  rawMarketData: MarketSnapshot;
  newsContext: NewsContext;
  executionMode: "AUTO" | "ADVISORY"; // AUTO = Binance bot; ADVISORY = manual broker
}

export interface MarketSnapshot {
  price:          number;
  adx:            number;
  rsi1h:          number;  // for crypto; daily RSI for commodity/forex
  rsi4h:          number;
  bbWidth:        number;
  bbPosition:     number;
  macdHistogram:  number;
  macdBullish:    boolean;
  volumeRatio:    number;
  change24h:      number;
  dataInterval:   "hourly" | "daily";
}

const CG    = "https://api.coingecko.com/api/v3";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function cgGet<T>(url: string, params: Record<string, unknown>): Promise<T> {
  try {
    const { data } = await axios.get<T>(url, { params });
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      await sleep(10_000);
      const { data } = await axios.get<T>(url, { params });
      return data;
    }
    throw err;
  }
}

// ── Crypto snapshot (Bybit primary, CoinGecko fallback) ───────────────────────
async function buildCryptoSnapshot(symbol: string): Promise<MarketSnapshot> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) throw new Error(`Unsupported crypto symbol: ${symbol}`);

  // 1h data — CoinGecko market_chart (Bybit 1h: too many candles needed)
  const chart1h = await cgGet<{ prices: [number, number][]; total_volumes: [number, number][] }>(
    `${CG}/coins/${coinId}/market_chart`,
    { vs_currency: "usd", days: 5, interval: "hourly" }
  );
  await sleep(400);

  // 4h data — Bybit first (real OHLCV), fallback CoinGecko OHLC
  let closes4h: number[], highs4h: number[], lows4h: number[];
  try {
    const klines4h = await getKlinesBybit(symbol, "4h", 100);
    closes4h = klines4h.map(k => k.close);
    highs4h  = klines4h.map(k => k.high);
    lows4h   = klines4h.map(k => k.low);
  } catch {
    await sleep(400);
    const ohlc4h = await cgGet<[number, number, number, number, number][]>(
      `${CG}/coins/${coinId}/ohlc`,
      { vs_currency: "usd", days: 7 }
    );
    closes4h = ohlc4h.map(c => c[4]);
    highs4h  = ohlc4h.map(c => c[2]);
    lows4h   = ohlc4h.map(c => c[3]);
  }
  await sleep(400);

  const priceData = await cgGet<Record<string, { usd: number; usd_24h_change: number }>>(
    `${CG}/simple/price`,
    { ids: coinId, vs_currencies: "usd", include_24hr_change: true }
  );

  const closes1h  = chart1h.prices.map(([, p]) => p);
  const volumes1h = chart1h.total_volumes.map(([, v]) => v);

  const coinInfo = priceData[coinId];
  if (!coinInfo) throw new Error(`CoinGecko returned no data for ${symbol}`);
  const currentPrice = coinInfo.usd;
  const change24h    = coinInfo.usd_24h_change;

  const rsi1h = (RSI.calculate({ period: 14, values: closes1h }) ?? []).slice(-1)[0] ?? 50;
  const rsi4h = (RSI.calculate({ period: 14, values: closes4h }) ?? []).slice(-1)[0] ?? 50;

  const bbArr      = BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 });
  const bb         = bbArr[bbArr.length - 1];
  const bbWidth    = bb ? (bb.upper - bb.lower) / bb.middle : 0.02;
  const bbPosition = bb && bb.upper !== bb.lower ? (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5;

  const macdArr     = MACD.calculate({ values: closes4h, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const macdLast    = macdArr[macdArr.length - 1];
  const macdPrev    = macdArr[macdArr.length - 2];
  const macdHistogram = macdLast?.histogram ?? 0;
  const macdBullish   = (macdHistogram > 0) || ((macdPrev?.histogram ?? 0) < 0 && macdHistogram >= 0);

  let adxValue = 20;
  try {
    const adxArr = ADX.calculate({ period: 14, high: highs4h, low: lows4h, close: closes4h });
    adxValue = adxArr[adxArr.length - 1]?.adx ?? 20;
  } catch { /* default */ }

  const recentVol   = volumes1h.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const baselineVol = volumes1h.slice(-24, -3).reduce((s, v) => s + v, 0) / 21;
  const volumeRatio = baselineVol > 0 ? recentVol / baselineVol : 1;

  return { price: currentPrice, adx: adxValue, rsi1h, rsi4h, bbWidth, bbPosition, macdHistogram, macdBullish, volumeRatio, change24h, dataInterval: "hourly" };
}

// ── Commodity / Forex snapshot via Yahoo Finance ──────────────────────────────
async function buildYahooSnapshot(symbol: string): Promise<MarketSnapshot> {
  interface YahooResp {
    chart: {
      result: [{
        meta: { regularMarketPrice: number; previousClose?: number };
        indicators: {
          quote: [{ open: (number|null)[]; high: (number|null)[]; low: (number|null)[]; close: (number|null)[]; volume: (number|null)[] }];
        };
      }] | null;
      error?: { description: string };
    };
  }

  const { data } = await axios.get<YahooResp>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { params: { interval: "1d", range: "1y" }, headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }
  );

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(data?.chart?.error?.description ?? `No Yahoo Finance data for ${symbol}`);

  const q = result.indicators.quote[0];
  const closes  = q.close.filter((c): c is number => c !== null && !isNaN(c));
  const highs   = q.high.filter((h): h is number => h !== null && !isNaN(h));
  const lows    = q.low.filter((l): l is number => l !== null && !isNaN(l));
  const volumes = q.volume.filter((v): v is number => v !== null && !isNaN(v));

  if (closes.length < 30) throw new Error(`Only ${closes.length} daily bars for ${symbol} — need ≥30`);

  const currentPrice = result.meta.regularMarketPrice;
  const prevClose    = result.meta.previousClose ?? closes[closes.length - 2];
  const change24h    = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

  const rsiDaily = (RSI.calculate({ period: 14, values: closes }) ?? []).slice(-1)[0] ?? 50;

  const bbArr      = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const bb         = bbArr[bbArr.length - 1];
  const bbWidth    = bb ? (bb.upper - bb.lower) / bb.middle : 0.02;
  const bbPosition = bb && bb.upper !== bb.lower ? (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5;

  const macdArr     = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const macdLast    = macdArr[macdArr.length - 1];
  const macdPrev    = macdArr[macdArr.length - 2];
  const macdHistogram = macdLast?.histogram ?? 0;
  const macdBullish   = (macdHistogram > 0) || ((macdPrev?.histogram ?? 0) < 0 && macdHistogram >= 0);

  let adxValue = 20;
  if (highs.length >= 28 && lows.length >= 28) {
    try {
      const adxArr = ADX.calculate({ period: 14, high: highs.slice(-60), low: lows.slice(-60), close: closes.slice(-60) });
      adxValue = adxArr[adxArr.length - 1]?.adx ?? 20;
    } catch { /* default */ }
  }

  let volumeRatio = 1;
  if (volumes.length >= 24) {
    const recent   = volumes.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const baseline = volumes.slice(-24, -3).reduce((s, v) => s + v, 0) / 21;
    volumeRatio = baseline > 0 ? recent / baseline : 1;
  }

  return { price: currentPrice, adx: adxValue, rsi1h: rsiDaily, rsi4h: rsiDaily, bbWidth, bbPosition, macdHistogram, macdBullish, volumeRatio, change24h, dataInterval: "daily" };
}

// ── Market description string for Claude ──────────────────────────────────────
function describeMarket(snap: MarketSnapshot, news: NewsContext, category: AssetCategory): string {
  const isDaily  = snap.dataInterval === "daily";
  const ivLabel  = isDaily ? "Daily" : "1H / 4H";

  const adxLabel  = snap.adx < 18 ? "RANGING" : snap.adx < 25 ? "WEAK TREND" : snap.adx < 35 ? "MODERATE TREND" : "STRONG TREND";
  const rsiLabel  = snap.rsi1h < 30 ? "OVERSOLD" : snap.rsi1h > 70 ? "OVERBOUGHT" : "NEUTRAL";
  const bbLabel   = snap.bbWidth < 0.015 ? "SQUEEZE — breakout imminent" : snap.bbWidth > 0.05 ? "EXPANDED — high volatility" : "NORMAL";
  const macdLabel = snap.macdBullish ? "BULLISH" : "BEARISH";
  const volLabel  = snap.volumeRatio > 2 ? "SURGE — strong conviction" : snap.volumeRatio < 0.5 ? "DRY — weak conviction" : "NORMAL";

  const techSection = [
    `Price: ${snap.price < 10 ? snap.price.toFixed(4) : `$${snap.price.toFixed(2)}`} (24h: ${snap.change24h > 0 ? "+" : ""}${snap.change24h.toFixed(2)}%)`,
    `ADX (${ivLabel}): ${snap.adx.toFixed(1)} — ${adxLabel}`,
    `RSI (${isDaily ? "14-day" : "1H"}): ${snap.rsi1h.toFixed(1)} — ${rsiLabel}`,
    isDaily ? null : `RSI 4H: ${snap.rsi4h.toFixed(1)}`,
    `BB Width (${isDaily ? "20-day" : "1H"}): ${(snap.bbWidth * 100).toFixed(2)}% — ${bbLabel}`,
    `BB Position: ${(snap.bbPosition * 100).toFixed(0)}% (0=lower band, 100=upper band)`,
    `MACD (${isDaily ? "daily" : "4H"}): ${snap.macdHistogram > 0 ? "+" : ""}${snap.macdHistogram.toFixed(6)} — ${macdLabel}`,
    `Volume vs baseline: ${snap.volumeRatio.toFixed(2)}x — ${volLabel}`,
  ].filter(Boolean).join("\n");

  const sentimentColor = news.sentiment === "BULLISH" ? "🟢" : news.sentiment === "BEARISH" ? "🔴" : "🟡";
  const newsSection = news.headlines.length > 0 ? [
    `\n## News Intelligence (${news.sources.join(", ")})`,
    `Overall sentiment: ${sentimentColor} ${news.sentiment} (score ${news.sentimentScore > 0 ? "+" : ""}${news.sentimentScore.toFixed(2)})`,
    `Bullish: ${news.bullishCount} headlines | Bearish: ${news.bearishCount} headlines`,
    `Recent headlines:`,
    ...news.headlines.slice(0, 7).map((h, i) => `${i + 1}. "${h}"`),
  ].join("\n") : "\n## News Intelligence\nNo news headlines retrieved — rely solely on technical data.";

  return techSection + newsSection;
}

export type AIProvider = "claude" | "nim" | "kimi";

// ── Main export ───────────────────────────────────────────────────────────────
export async function getBotRecommendation(
  symbol:    string,
  category:  AssetCategory = "crypto",
  provider:  AIProvider    = "claude",
  nimModel:  NimModelId    = DEFAULT_NIM_MODEL,
  kimiModel: KimiModelId   = DEFAULT_KIMI_MODEL,
): Promise<BotRecommendation> {
  // Validate API key before expensive market-data fetching
  if (provider === "nim") {
    if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not configured — get free credits at build.nvidia.com and add it to environment variables");
  } else if (provider === "kimi") {
    if (!process.env.MOONSHOT_API_KEY) throw new Error("MOONSHOT_API_KEY not configured — get free credits at platform.moonshot.cn and add it to environment variables");
  } else {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured — add it to environment variables");
  }

  // Build market snapshot (crypto via CoinGecko, others via Yahoo Finance)
  const snap = category === "crypto"
    ? await buildCryptoSnapshot(symbol)
    : await buildYahooSnapshot(symbol);

  // Fetch news context in parallel with Claude prep (non-blocking failure)
  const news = await fetchNewsContext(symbol, category).catch((): NewsContext => ({
    headlines: [], sentiment: "NEUTRAL", sentimentScore: 0,
    bullishCount: 0, bearishCount: 0, sources: [],
  }));

  const isCrypto     = category === "crypto";
  const assetLabel   = category === "crypto" ? "crypto (Binance)" : category === "commodity" ? "commodity" : "forex pair";
  const execNote     = isCrypto
    ? "Execution: Binance auto-bot (paper or live). Include standard bot config."
    : "Execution: Advisory only — user trades manually on their broker. No Binance bot fields needed.";

  const systemPrompt = `You are an expert investment analyst and algorithmic strategy architect. You combine technical analysis with financial news sentiment to give clear, actionable investment recommendations.

You analyze ${assetLabel} assets across Crypto, Commodities, and Forex markets.
${execNote}

## Strategy Selection (for crypto auto-bots)
**GRID** — ADX < 22, BB width 1.5–5%, price oscillating in range
**MACD** — ADX > 25, MACD histogram positive and rising, use 4H interval
**RSI** — RSI dips below 35 regularly, sideways-to-bullish market, use 4H
**DCA** — No clear pattern or strong long-term bullish asset, safest choice

## Investment Action Rules
- **BUY** when: RSI < 45 + MACD bullish + news sentiment BULLISH/NEUTRAL + ADX suggests trend or range-bottom
- **SELL/EXIT** when: RSI > 65 + MACD bearish + news sentiment BEARISH + near BB upper band
- **HOLD** when: conflicting signals or RSI 45–65 with neutral news

## Level Calculation
- Entry: current price
- Stop Loss: crypto 4–5%, commodity 1.5–2%, forex 0.5–0.8% from entry
- Take Profit: 2.2–2.5× risk distance (minimum 2:1 R/R)
- Adjust tighter if BB width is narrow; wider if ADX > 30

## News Integration
Weight news sentiment alongside technical signals:
- Strong bullish news + bullish technicals → increase confidence
- Conflicting signals (bearish news + bullish tech) → reduce confidence, flag risk
- Mention key news themes in rationale

Respond with ONLY valid JSON — no markdown fences, no extra text.`;

  const userMsg = `Analyze ${symbol} (${category}) and provide investment recommendation:

## Technical Data
${describeMarket(snap, news, category)}

Respond as JSON:
{
  "strategy": "DCA" | "RSI" | "MACD" | "GRID",
  "name": "<descriptive name ≤28 chars>",
  "config": { <strategy fields: amount(number), interval(string), plus strategy-specific> },
  "action": "BUY" | "SELL" | "HOLD",
  "actionReason": "<1-2 sentences: what specifically triggered this action right now>",
  "entryPrice": <current price as number>,
  "stopLoss": <calculated stop-loss price as number>,
  "takeProfit": <calculated take-profit price as number>,
  "riskReward": <ratio as number e.g. 2.2>,
  "rationale": "<2-3 sentences: why this strategy, what market condition, news impact>",
  "marketPhase": "RANGING" | "TRENDING_UP" | "TRENDING_DOWN" | "VOLATILE" | "ACCUMULATION",
  "confidence": <integer 45-92>,
  "safetyNotes": ["<risk note 1>", "<risk note 2>", "<note 3>"]
}`;

  let text: string;
  if (provider === "nim") {
    text = await callNIM(systemPrompt, userMsg, nimModel, 700);
  } else if (provider === "kimi") {
    text = await callKimi(systemPrompt, userMsg, kimiModel, 700);
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured — add it to environment variables");
    const client = new Anthropic({ apiKey });
    // System prompt cached per category — saves ~90% on input tokens for repeated calls
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected Claude response type");
    text = content.text.trim();
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) text = fenceMatch[1].trim();

  const parsed = JSON.parse(text) as Omit<BotRecommendation, "symbol" | "category" | "rawMarketData" | "newsContext" | "executionMode">;

  // Safety guards
  const cfg = parsed.config as Record<string, unknown>;
  if (typeof cfg.amount === "number" && cfg.amount < 15) cfg.amount = 15;
  if (cfg.interval === "30m" && parsed.strategy !== "DCA") cfg.interval = "1h";

  // Ensure price levels are sensible (fall back to calculated values if model hallucinated)
  const price    = snap.price;
  const slPct    = category === "forex" ? 0.007 : category === "commodity" ? 0.02 : 0.045;
  const tpPct    = slPct * 2.2;
  const isBuyAct = (parsed.action ?? "HOLD") === "BUY";

  const entryPrice = parsed.entryPrice && Math.abs(parsed.entryPrice - price) / price < 0.05 ? parsed.entryPrice : price;
  const stopLoss   = parsed.stopLoss  && parsed.stopLoss > 0 && Math.abs(parsed.stopLoss  - price) / price < 0.2
    ? parsed.stopLoss
    : isBuyAct ? price * (1 - slPct) : price * (1 + slPct);
  const takeProfit = parsed.takeProfit && parsed.takeProfit > 0 && Math.abs(parsed.takeProfit - price) / price < 0.4
    ? parsed.takeProfit
    : isBuyAct ? price * (1 + tpPct) : price * (1 - tpPct);
  const riskReward = parsed.riskReward && parsed.riskReward > 0 ? parsed.riskReward : 2.2;

  return {
    ...parsed,
    symbol,
    category,
    entryPrice,
    stopLoss,
    takeProfit,
    riskReward,
    rawMarketData: snap,
    newsContext: news,
    executionMode: isCrypto ? "AUTO" : "ADVISORY",
  };
}
