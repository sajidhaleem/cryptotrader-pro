// Expert Multi-Timeframe AI Intelligence Engine
// 13 indicators across 1h + 4h + 1d with ATR stops, ADX trend filter, and candlestick patterns
// Market data via CoinGecko — Binance public endpoints return 451 from US-hosted Netlify servers
import { RSI, MACD, BollingerBands, EMA, ATR, ADX, StochasticRSI } from "technicalindicators";
import { prisma } from "./db";
import type { Kline } from "./binance";
import { getKlinesCG, getFearGreedIndex, getNewsSentiment } from "./market-data";

export interface FactorScore {
  indicator: string;
  rawValue: number | string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  score: number;        // -100 to +100
  weight: number;
  contribution: number;
  explanation: string;
}

export interface IntelligenceReport {
  symbol: string;
  price: number;
  finalScore: number;
  confidence: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  side: "BUY" | "SELL" | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSizePct: number;
  atr: number;
  trendStrength: number;
  multiTFAlignment: boolean;
  factors: FactorScore[];
  summary: string;
  marketCondition: string;
  fearGreedValue: number;
  fearGreedLabel: string;
  analysedAt: Date;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  RSI_1H:     1.2,
  RSI_4H:     1.6,
  RSI_1D:     1.0,
  STOCH_RSI:  1.0,
  MACD_4H:    1.5,
  BB_1H:      1.1,
  EMA_4H:     1.3,
  EMA_1D:     1.2,
  CANDLE:     0.9,
  FEAR_GREED: 1.2,
  NEWS:       0.7,
  ORDER_BOOK: 0.8,
  VOLUME:     0.7,
};

async function getUserWeights(userId: string): Promise<Record<string, number>> {
  const dbWeights = await prisma.signalWeight.findMany({ where: { userId } });
  const result = { ...DEFAULT_WEIGHTS };
  for (const w of dbWeights) {
    const total = w.wins + w.losses;
    if (total >= 5) {
      result[w.indicator] = (DEFAULT_WEIGHTS[w.indicator] ?? 1.0) * (0.5 + w.wins / total);
    }
  }
  return result;
}

function cls(klines: Kline[]): number[] { return klines.map(k => k.close); }
function hgh(klines: Kline[]): number[] { return klines.map(k => k.high); }
function lw(klines: Kline[]): number[] { return klines.map(k => k.low); }
function neutral(indicator: string): FactorScore {
  return { indicator, rawValue: 0, signal: "NEUTRAL", score: 0, weight: 1, contribution: 0, explanation: "Insufficient data" };
}

function rsiScore(indicator: string, values: number[]): FactorScore {
  if (values.length < 16) return neutral(indicator);
  const result = RSI.calculate({ period: 14, values });
  const rsi = result[result.length - 1];
  if (rsi == null) return neutral(indicator);

  const tf = indicator.includes("4H") ? "4H" : indicator.includes("1D") ? "1D" : "1H";
  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (rsi <= 20) { signal = "BUY";  score =  95; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — extremely oversold, strong bounce expected`; }
  else if (rsi <= 30) { signal = "BUY";  score =  75; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — oversold, reversal zone`; }
  else if (rsi <= 40) { signal = "BUY";  score =  30; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — mildly oversold`; }
  else if (rsi >= 80) { signal = "SELL"; score = -95; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — extremely overbought, correction likely`; }
  else if (rsi >= 70) { signal = "SELL"; score = -75; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — overbought zone`; }
  else if (rsi >= 60) { signal = "SELL"; score = -30; explanation = `RSI ${rsi.toFixed(1)} (${tf}) — mildly overbought`; }
  else               { score = Math.round((50 - rsi) * 0.8); explanation = `RSI ${rsi.toFixed(1)} (${tf}) — neutral`; }

  return { indicator, rawValue: rsi, signal, score, weight: 1, contribution: 0, explanation };
}

function stochRsiScore(values: number[]): FactorScore {
  if (values.length < 35) return neutral("STOCH_RSI");
  try {
    const result = StochasticRSI.calculate({ values, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 });
    const last = result[result.length - 1];
    const prev = result[result.length - 2];
    if (!last || !prev) return neutral("STOCH_RSI");

    const k = last.k * 100;
    const d = last.d * 100;
    const prevK = prev.k * 100;
    const crossingUp = prevK < prev.d * 100 && k > d;
    const crossingDown = prevK > prev.d * 100 && k < d;

    let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
    let score = 0;
    let explanation = "";

    if      (crossingUp && k < 20)  { signal = "BUY";  score =  85; explanation = `Stoch RSI K(${k.toFixed(0)}) bullish cross in oversold zone — precise buy entry`; }
    else if (k < 15)                 { signal = "BUY";  score =  65; explanation = `Stoch RSI ${k.toFixed(0)} — deeply oversold on 1H`; }
    else if (k < 25)                 { signal = "BUY";  score =  40; explanation = `Stoch RSI ${k.toFixed(0)} — oversold territory`; }
    else if (crossingDown && k > 80) { signal = "SELL"; score = -85; explanation = `Stoch RSI K(${k.toFixed(0)}) bearish cross in overbought zone — precise sell entry`; }
    else if (k > 85)                 { signal = "SELL"; score = -65; explanation = `Stoch RSI ${k.toFixed(0)} — deeply overbought on 1H`; }
    else if (k > 75)                 { signal = "SELL"; score = -40; explanation = `Stoch RSI ${k.toFixed(0)} — overbought territory`; }
    else                             { explanation = `Stoch RSI ${k.toFixed(0)} — neutral range`; }

    return { indicator: "STOCH_RSI", rawValue: k.toFixed(1), signal, score, weight: 1, contribution: 0, explanation };
  } catch {
    return neutral("STOCH_RSI");
  }
}

function macd4hScore(values: number[]): FactorScore {
  if (values.length < 35) return neutral("MACD_4H");
  const result = MACD.calculate({ values, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const last = result[result.length - 1];
  const prev = result[result.length - 2];
  const prev2 = result[result.length - 3];
  if (!last || !prev) return neutral("MACD_4H");

  const hist     = last.histogram  ?? 0;
  const prevHist = prev.histogram  ?? 0;
  const prev2H   = prev2?.histogram ?? 0;
  const rising = hist > prevHist;
  const accelerating = hist > prevHist && prevHist > prev2H;
  const bullishCross = prevHist <= 0 && hist > 0;
  const bearishCross = prevHist >= 0 && hist < 0;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (bullishCross)        { signal = "BUY";  score =  90; explanation = "MACD 4H histogram crossed zero — bullish momentum confirmed"; }
  else if (hist > 0 && accelerating) { signal = "BUY"; score = 75; explanation = "MACD 4H positive & accelerating — strong bull momentum"; }
  else if (hist > 0 && rising)  { signal = "BUY";  score =  50; explanation = "MACD 4H positive and rising — bullish momentum building"; }
  else if (hist > 0)            { signal = "BUY";  score =  20; explanation = "MACD 4H positive but decelerating — weakening bull"; }
  else if (bearishCross)        { signal = "SELL"; score = -90; explanation = "MACD 4H histogram crossed zero — bearish momentum confirmed"; }
  else if (hist < 0 && !rising && prevHist < prev2H) { signal = "SELL"; score = -75; explanation = "MACD 4H accelerating bearish"; }
  else if (hist < 0 && !rising) { signal = "SELL"; score = -50; explanation = "MACD 4H negative and falling — bear momentum"; }
  else if (hist < 0)            { signal = "SELL"; score = -20; explanation = "MACD 4H negative but recovering"; }
  else                          { explanation = "MACD 4H neutral"; }

  return { indicator: "MACD_4H", rawValue: hist.toFixed(4), signal, score, weight: 1, contribution: 0, explanation };
}

function bb1hScore(values: number[], currentPrice: number): FactorScore {
  if (values.length < 22) return neutral("BB_1H");
  const result = BollingerBands.calculate({ period: 20, values, stdDev: 2 });
  const band = result[result.length - 1];
  if (!band) return neutral("BB_1H");

  const range = band.upper - band.lower;
  if (range === 0) return neutral("BB_1H");
  const pos = (currentPrice - band.lower) / range;
  const bw = range / band.middle;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (pos <= 0.05) { signal = "BUY";  score =  90; explanation = `Price touching lower Bollinger Band (1H) — extreme mean reversion setup`; }
  else if (pos <= 0.15) { signal = "BUY";  score =  70; explanation = `Price at lower BB zone (${(pos * 100).toFixed(0)}%) — strong buy zone`; }
  else if (pos <= 0.30) { signal = "BUY";  score =  35; explanation = `Price in lower BB zone (${(pos * 100).toFixed(0)}%) — mild buy`; }
  else if (pos >= 0.95) { signal = "SELL"; score = -90; explanation = `Price touching upper Bollinger Band (1H) — extreme mean reversion sell`; }
  else if (pos >= 0.85) { signal = "SELL"; score = -70; explanation = `Price at upper BB zone (${(pos * 100).toFixed(0)}%) — strong sell zone`; }
  else if (pos >= 0.70) { signal = "SELL"; score = -35; explanation = `Price in upper BB zone (${(pos * 100).toFixed(0)}%) — mild sell`; }
  else {
    explanation = `Bollinger mid-zone (${(pos * 100).toFixed(0)}%)${bw < 0.02 ? " — Squeeze: breakout imminent" : ""}`;
  }

  return { indicator: "BB_1H", rawValue: pos.toFixed(2), signal, score, weight: 1, contribution: 0, explanation };
}

function ema4hScore(values: number[]): FactorScore {
  if (values.length < 55) return neutral("EMA_4H");
  const ema20 = EMA.calculate({ period: 20, values });
  const ema50 = EMA.calculate({ period: 50, values });
  const fast = ema20[ema20.length - 1];
  const slow = ema50[ema50.length - 1];
  const prevFast = ema20[ema20.length - 2];
  const prevSlow = ema50[ema50.length - 2];

  const crossedUp   = prevFast <= prevSlow && fast > slow;
  const crossedDown = prevFast >= prevSlow && fast < slow;
  const gap = ((fast - slow) / slow) * 100;
  const signal: "BUY" | "SELL" | "NEUTRAL" = fast > slow ? "BUY" : "SELL";
  let score = 0;
  let explanation = "";

  if      (crossedUp)   { score =  95; explanation = "EMA20/50 Golden Cross on 4H — very bullish trend change"; }
  else if (crossedDown) { score = -95; explanation = "EMA20/50 Death Cross on 4H — very bearish trend change"; }
  else if (fast > slow) { score = Math.min(65, gap * 8);  explanation = `4H EMA20 ${gap.toFixed(2)}% above EMA50 — uptrend confirmed`; }
  else                  { score = Math.max(-65, gap * 8); explanation = `4H EMA20 ${Math.abs(gap).toFixed(2)}% below EMA50 — downtrend confirmed`; }

  return { indicator: "EMA_4H", rawValue: `${fast.toFixed(2)}/${slow.toFixed(2)}`, signal, score, weight: 1, contribution: 0, explanation };
}

function ema1dScore(values: number[]): FactorScore {
  if (values.length < 55) return neutral("EMA_1D");
  const ema50 = EMA.calculate({ period: 50, values });
  const longPeriod = Math.min(200, values.length - 5);
  const emaLong = EMA.calculate({ period: longPeriod, values });

  const fast = ema50[ema50.length - 1];
  const slow = emaLong[emaLong.length - 1];
  const price = values[values.length - 1];
  if (!fast || !slow) return neutral("EMA_1D");

  const aboveFast = price > fast;
  const fastAboveSlow = fast > slow;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if (aboveFast && fastAboveSlow)  { signal = "BUY";  score =  70; explanation = `Daily price above EMA50 & EMA${longPeriod} — macro uptrend confirmed`; }
  else if (!aboveFast && !fastAboveSlow) { signal = "SELL"; score = -70; explanation = `Daily price below EMA50 & EMA${longPeriod} — macro downtrend`; }
  else if (aboveFast)              { signal = "NEUTRAL"; score = 15; explanation = `Price above EMA50 but below EMA${longPeriod} — mixed macro`; }
  else                             { signal = "SELL"; score = -20; explanation = `Price below EMA50 — macro uncertain`; }

  return { indicator: "EMA_1D", rawValue: `${fast.toFixed(0)}/${slow.toFixed(0)}`, signal, score, weight: 1, contribution: 0, explanation };
}

function candlePatternScore(klines: Kline[]): FactorScore {
  if (klines.length < 3) return neutral("CANDLE");
  const c  = klines[klines.length - 1];
  const p  = klines[klines.length - 2];
  const p2 = klines[klines.length - 3];

  const body   = Math.abs(c.close - c.open);
  const range  = c.high - c.low;
  if (range === 0) return neutral("CANDLE");

  const upper  = c.high - Math.max(c.open, c.close);
  const lower  = Math.min(c.open, c.close) - c.low;
  const bull   = c.close > c.open;
  const prevBull = p.close > p.open;
  const pBody  = Math.abs(p.close - p.open);

  // Hammer
  if (body > 0 && lower >= body * 2 && upper <= body * 0.5) {
    return { indicator: "CANDLE", rawValue: "Hammer", signal: "BUY", score: 70, weight: 1, contribution: 0,
      explanation: "Hammer on 1H — buyers strongly rejected lower prices, bullish reversal" };
  }
  // Shooting Star
  if (body > 0 && upper >= body * 2 && lower <= body * 0.5) {
    return { indicator: "CANDLE", rawValue: "Shooting Star", signal: "SELL", score: -70, weight: 1, contribution: 0,
      explanation: "Shooting star on 1H — sellers rejected rally, bearish reversal likely" };
  }
  // Bullish Engulfing
  if (bull && !prevBull && pBody > 0 && c.open <= p.close && c.close >= p.open) {
    return { indicator: "CANDLE", rawValue: "Bullish Engulfing", signal: "BUY", score: 80, weight: 1, contribution: 0,
      explanation: "Bullish engulfing on 1H — buyers fully absorbed sellers, strong reversal" };
  }
  // Bearish Engulfing
  if (!bull && prevBull && pBody > 0 && c.open >= p.close && c.close <= p.open) {
    return { indicator: "CANDLE", rawValue: "Bearish Engulfing", signal: "SELL", score: -80, weight: 1, contribution: 0,
      explanation: "Bearish engulfing on 1H — sellers overwhelmed buyers, strong reversal" };
  }
  // Morning Star (3-candle bullish reversal)
  const pRange = p.high - p.low;
  if (pRange > 0 && pBody / pRange < 0.15 && !prevBull === false && // small middle candle (doji-like)
      p2.close < p2.open &&  // prev2 bearish
      bull && c.close > (p2.open + p2.close) / 2) {
    return { indicator: "CANDLE", rawValue: "Morning Star", signal: "BUY", score: 85, weight: 1, contribution: 0,
      explanation: "Morning star on 1H — three-candle bullish reversal confirmation" };
  }
  // Doji
  if (body / range < 0.08) {
    return { indicator: "CANDLE", rawValue: "Doji", signal: "NEUTRAL", score: 0, weight: 1, contribution: 0,
      explanation: "Doji on 1H — market indecision, wait for next candle direction" };
  }
  // Strong trend candle
  if (body / range > 0.72) {
    if (bull) return { indicator: "CANDLE", rawValue: "Strong Bull", signal: "BUY", score: 40, weight: 1, contribution: 0,
      explanation: "Strong bullish candle (marubozu) — sustained buying pressure" };
    return { indicator: "CANDLE", rawValue: "Strong Bear", signal: "SELL", score: -40, weight: 1, contribution: 0,
      explanation: "Strong bearish candle — sustained selling pressure" };
  }

  return neutral("CANDLE");
  void p2; // p2 used above in morning star
}

function fearGreedScore(value: number, label: string): FactorScore {
  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (value <= 15) { signal = "BUY";  score =  90; explanation = `Extreme Fear (${value}) — capitulation zone, max contrarian buy`; }
  else if (value <= 25) { signal = "BUY";  score =  70; explanation = `Extreme Fear (${value}) — strong contrarian buy opportunity`; }
  else if (value <= 40) { signal = "BUY";  score =  35; explanation = `Fear (${value}) — market below fair sentiment`; }
  else if (value >= 85) { signal = "SELL"; score = -90; explanation = `Extreme Greed (${value}) — euphoria peak, max contrarian sell`; }
  else if (value >= 75) { signal = "SELL"; score = -70; explanation = `Extreme Greed (${value}) — overextended market`; }
  else if (value >= 60) { signal = "SELL"; score = -35; explanation = `Greed (${value}) — elevated sentiment, caution warranted`; }
  else                  { explanation = `Neutral sentiment (${value} — ${label})`; }

  return { indicator: "FEAR_GREED", rawValue: value, signal, score, weight: 1, contribution: 0, explanation };
}

function newsScore(sentimentScore: number): FactorScore {
  const score = Math.round(sentimentScore * 70);
  const signal: "BUY" | "SELL" | "NEUTRAL" = sentimentScore > 0.2 ? "BUY" : sentimentScore < -0.2 ? "SELL" : "NEUTRAL";
  return {
    indicator: "NEWS", rawValue: sentimentScore.toFixed(2), signal, score, weight: 1, contribution: 0,
    explanation: `News sentiment: ${sentimentScore > 0 ? "+" : ""}${sentimentScore.toFixed(2)} (${signal.toLowerCase()})`,
  };
}

function orderBookScore(ob: { bids: [string, string][]; asks: [string, string][] }): FactorScore {
  if (!ob.bids.length || !ob.asks.length) return neutral("ORDER_BOOK");
  const bidVol = ob.bids.slice(0, 5).reduce((s, [, q]) => s + parseFloat(q), 0);
  const askVol = ob.asks.slice(0, 5).reduce((s, [, q]) => s + parseFloat(q), 0);
  if (askVol === 0) return neutral("ORDER_BOOK");
  const ratio = bidVol / askVol;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (ratio >= 2.0) { signal = "BUY";  score =  70; explanation = `Order book: ${ratio.toFixed(2)}x bids vs asks — heavy buyer pressure`; }
  else if (ratio >= 1.5) { signal = "BUY";  score =  40; explanation = `Order book: ${ratio.toFixed(2)}x bid pressure — buyers in control`; }
  else if (ratio <= 0.5) { signal = "SELL"; score = -70; explanation = `Order book: ${ratio.toFixed(2)}x bid/ask — heavy sell pressure`; }
  else if (ratio <= 0.67){ signal = "SELL"; score = -40; explanation = `Order book: ${ratio.toFixed(2)}x — sellers dominate`; }
  else                   { explanation = `Order book balanced (${ratio.toFixed(2)}x)`; }

  return { indicator: "ORDER_BOOK", rawValue: ratio.toFixed(2), signal, score, weight: 1, contribution: 0, explanation };
}

function volumeScore(volumes: number[]): FactorScore {
  if (volumes.length < 24) return neutral("VOLUME");
  const recent   = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const baseline = volumes.slice(-24, -3).reduce((a, b) => a + b, 0) / Math.max(1, volumes.slice(-24, -3).length);
  if (baseline === 0) return neutral("VOLUME");
  const ratio = recent / baseline;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if      (ratio >= 2.5) { signal = "BUY"; score = 65; explanation = `Volume surge: ${ratio.toFixed(1)}x average — high-conviction move with strong participation`; }
  else if (ratio >= 1.5) { signal = "BUY"; score = 35; explanation = `Volume elevated: ${ratio.toFixed(1)}x average — confirms price move`; }
  else if (ratio <= 0.4) { score = -25; explanation = `Volume dry: ${ratio.toFixed(1)}x — weak conviction, breakout suspect`; }
  else                   { explanation = `Volume normal: ${ratio.toFixed(1)}x average`; }

  return { indicator: "VOLUME", rawValue: `${ratio.toFixed(2)}x`, signal, score, weight: 1, contribution: 0, explanation };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function analyzeSymbol(symbol: string, userId?: string): Promise<IntelligenceReport | null> {
  // Sequential CoinGecko calls with small delays to stay within 30 req/min free tier limit.
  // Binance public endpoints return 451 from Netlify's US servers — CoinGecko has no geo-block.
  const klines1h = await getKlinesCG(symbol, "1h", 200);
  await sleep(350);
  const klines4h = await getKlinesCG(symbol, "4h", 150);
  await sleep(350);
  const klines1d = await getKlinesCG(symbol, "1d", 100);
  await sleep(200);
  const [fearGreed, news] = await Promise.all([
    getFearGreedIndex(),
    getNewsSentiment(symbol),
  ]);
  // Order book requires Binance authenticated endpoint — no CoinGecko equivalent.
  // Use neutral score so the other 12 indicators still produce a valid recommendation.
  const orderBook = { bids: [] as [string, string][], asks: [] as [string, string][] };

  if (klines1h.length < 50 || klines4h.length < 50) return null;

  const price    = klines1h[klines1h.length - 1].close;
  const closes1h = cls(klines1h);
  const closes4h = cls(klines4h);
  const closes1d = cls(klines1d);
  const vols1h   = klines1h.map(k => k.volume);

  // ATR-based dynamic stop loss (1H chart)
  const atrValues = ATR.calculate({ period: 14, high: hgh(klines1h), low: lw(klines1h), close: closes1h });
  const atr = atrValues[atrValues.length - 1] ?? price * 0.01;

  // ADX trend strength (4H chart)
  let adxValue = 20;
  try {
    const adxResults = ADX.calculate({ period: 14, high: hgh(klines4h), low: lw(klines4h), close: closes4h });
    adxValue = adxResults[adxResults.length - 1]?.adx ?? 20;
  } catch { /* use default */ }

  const rawFactors: FactorScore[] = [
    rsiScore("RSI_1H", closes1h),
    rsiScore("RSI_4H", closes4h),
    rsiScore("RSI_1D", closes1d),
    stochRsiScore(closes1h),
    macd4hScore(closes4h),
    bb1hScore(closes1h, price),
    ema4hScore(closes4h),
    ema1dScore(closes1d),
    candlePatternScore(klines1h.slice(-5)),
    fearGreedScore(fearGreed.value, fearGreed.classification),
    newsScore(news.score),
    orderBookScore(orderBook as { bids: [string, string][]; asks: [string, string][] }),
    volumeScore(vols1h),
  ];

  // Multi-timeframe alignment
  const sig1h = rawFactors[0].signal;
  const sig4h = rawFactors[1].signal;
  const sig1d = rawFactors[2].signal;
  const multiTFAlignment = sig1h !== "NEUTRAL" && sig1h === sig4h && sig4h === sig1d;
  const partialAlignment = (sig4h === sig1d && sig4h !== "NEUTRAL") || (sig1h === sig4h && sig1h !== "NEUTRAL");

  const weights = userId ? await getUserWeights(userId) : DEFAULT_WEIGHTS;
  const factors = rawFactors.map(f => {
    const w = weights[f.indicator] ?? 1.0;
    return { ...f, weight: w, contribution: f.score * w };
  });

  const totalWeight  = factors.reduce((a, f) => a + Math.abs(f.weight), 0);
  const weightedSum  = factors.reduce((a, f) => a + f.contribution, 0);
  let finalScore     = Math.round(weightedSum / totalWeight);

  // Confluence modifiers
  if (multiTFAlignment)    finalScore = Math.round(finalScore * 1.20);
  else if (!partialAlignment) finalScore = Math.round(finalScore * 0.70);
  finalScore = Math.max(-100, Math.min(100, finalScore));

  // ADX confidence modifier — softened so ranging markets still surface signals
  let confidence = Math.min(100, Math.round(Math.abs(finalScore)));
  if      (adxValue < 15) confidence = Math.round(confidence * 0.55);
  else if (adxValue < 20) confidence = Math.round(confidence * 0.75);
  else if (adxValue < 25) confidence = Math.round(confidence * 0.90);
  else if (adxValue > 35) confidence = Math.min(100, Math.round(confidence * 1.20));

  let recommendation: IntelligenceReport["recommendation"] = "HOLD";
  let side: "BUY" | "SELL" | null = null;
  if      (finalScore >=  55) { recommendation = "STRONG_BUY";  side = "BUY";  }
  else if (finalScore >=  25) { recommendation = "BUY";         side = "BUY";  }
  else if (finalScore <= -55) { recommendation = "STRONG_SELL"; side = "SELL"; }
  else if (finalScore <= -25) { recommendation = "SELL";        side = "SELL"; }

  // ATR-based stop: 1.5x ATR, 3:1 risk-reward
  const stopDist = atr * 1.5;
  const rrr = 3.0;
  let stopLoss = 0, takeProfit = 0;
  if (side === "BUY")  { stopLoss = price - stopDist; takeProfit = price + stopDist * rrr; }
  if (side === "SELL") { stopLoss = price + stopDist; takeProfit = price - stopDist * rrr; }

  // Position sizing: 0.5-3%, boosted by strong trend
  const trendBonus = adxValue > 35 ? 1.3 : adxValue > 25 ? 1.1 : 1.0;
  const positionSizePct = Math.min(3, Math.max(0.5, (confidence / 50) * trendBonus));

  const topFactor = [...factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const alignLabel = multiTFAlignment ? "✓ All 3 timeframes aligned. " : partialAlignment ? "Partial TF alignment. " : "";

  const marketCondition =
    adxValue > 35 ? `Strong trend (ADX ${adxValue.toFixed(0)}) — high-probability directional setup` :
    adxValue > 25 ? `Moderate trend (ADX ${adxValue.toFixed(0)}) — tradeable with stops` :
    adxValue > 15 ? `Weak trend (ADX ${adxValue.toFixed(0)}) — reduce position size` :
    `Ranging market (ADX ${adxValue.toFixed(0)}) — avoid trend strategies`;

  const summary = side
    ? `${recommendation.replace("_", " ")} on ${symbol.replace("USDT", "/USDT")} — ${confidence}% confidence. ` +
      `${alignLabel}${marketCondition.split(" — ")[0]}. ` +
      `Primary: ${topFactor?.explanation}. ` +
      `Entry $${price.toFixed(2)}, stop $${stopLoss.toFixed(2)} (${(stopDist / price * 100).toFixed(1)}% risk), target $${takeProfit.toFixed(2)}.`
    : `No clear edge on ${symbol.replace("USDT", "/USDT")} — signals disagree across timeframes. ` +
      (adxValue < 20 ? "Ranging market — wait for trend." : "Wait for alignment.");

  return {
    symbol, price, finalScore, confidence, recommendation, side,
    entryPrice: price, stopLoss, takeProfit, riskRewardRatio: rrr,
    positionSizePct, atr, trendStrength: adxValue, multiTFAlignment,
    factors, summary, marketCondition,
    fearGreedValue: fearGreed.value, fearGreedLabel: fearGreed.classification,
    analysedAt: new Date(),
  };
}

export async function recordOutcome(userId: string, proposalId: string, won: boolean) {
  const proposal = await prisma.tradeProposal.findUnique({
    where: { id: proposalId },
    select: { reasoning: true },
  });
  if (!proposal) return;

  const reasoning = proposal.reasoning as Record<string, unknown>;
  const factors   = (reasoning.factors ?? []) as Array<{ indicator: string }>;

  await Promise.all(
    factors.map((f) =>
      prisma.signalWeight.upsert({
        where:  { userId_indicator: { userId, indicator: f.indicator } },
        update: won ? { wins: { increment: 1 } } : { losses: { increment: 1 } },
        create: { userId, indicator: f.indicator, wins: won ? 1 : 0, losses: won ? 0 : 1 },
      })
    )
  );
}
