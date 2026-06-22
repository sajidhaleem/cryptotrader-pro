// AI Intelligence Engine — multi-factor weighted scoring with adaptive learning
import { RSI, MACD, BollingerBands, EMA } from "technicalindicators";
import { prisma } from "./db";
import { getFearGreedIndex, getMarketData, getNewsSentiment, getVolumeTrend } from "./market-data";

export interface FactorScore {
  indicator: string;
  rawValue: number | string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  score: number;       // -100 to +100 (negative = sell, positive = buy)
  weight: number;      // learned weight
  contribution: number; // score * weight
  explanation: string;
}

export interface IntelligenceReport {
  symbol: string;
  price: number;
  finalScore: number;   // -100 to +100
  confidence: number;   // 0-100 (certainty of signal)
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  side: "BUY" | "SELL" | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSizePct: number; // % of balance to risk
  factors: FactorScore[];
  summary: string;
  marketCondition: string;
  fearGreedValue: number;
  fearGreedLabel: string;
  analysedAt: Date;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  RSI: 1.5,
  MACD: 1.5,
  BB: 1.2,
  EMA: 1.0,
  FEAR_GREED: 1.3,
  VOLUME: 0.8,
  NEWS: 0.7,
  MOMENTUM: 1.0,
};

async function getUserWeights(userId: string): Promise<Record<string, number>> {
  const weights = await prisma.signalWeight.findMany({ where: { userId } });
  const result = { ...DEFAULT_WEIGHTS };
  for (const w of weights) {
    const total = w.wins + w.losses;
    if (total >= 5) {
      // Bayesian weight update: better than 50% win rate = higher weight
      const winRate = w.wins / total;
      result[w.indicator] = DEFAULT_WEIGHTS[w.indicator] * (0.5 + winRate);
    }
  }
  return result;
}

function rsiScore(closes: number[]): FactorScore {
  const values = RSI.calculate({ period: 14, values: closes });
  const rsi = values[values.length - 1];
  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if (rsi <= 25) { signal = "BUY"; score = 90; explanation = `RSI ${rsi.toFixed(1)} — extremely oversold, strong bounce expected`; }
  else if (rsi <= 35) { signal = "BUY"; score = 65; explanation = `RSI ${rsi.toFixed(1)} — oversold, likely reversal zone`; }
  else if (rsi <= 45) { signal = "BUY"; score = 25; explanation = `RSI ${rsi.toFixed(1)} — mildly oversold`; }
  else if (rsi >= 75) { signal = "SELL"; score = -90; explanation = `RSI ${rsi.toFixed(1)} — extremely overbought, correction likely`; }
  else if (rsi >= 65) { signal = "SELL"; score = -65; explanation = `RSI ${rsi.toFixed(1)} — overbought, caution`; }
  else if (rsi >= 55) { signal = "SELL"; score = -25; explanation = `RSI ${rsi.toFixed(1)} — mildly overbought`; }
  else { score = 0; explanation = `RSI ${rsi.toFixed(1)} — neutral zone`; }

  return { indicator: "RSI", rawValue: rsi, signal, score, weight: 1, contribution: 0, explanation };
}

function macdScore(closes: number[]): FactorScore {
  const results = MACD.calculate({
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  const last = results[results.length - 1];
  const prev = results[results.length - 2];

  const histogram = last?.histogram ?? 0;
  const prevHist = prev?.histogram ?? 0;
  const rising = histogram > prevHist;

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if (histogram > 0 && rising) { signal = "BUY"; score = 80; explanation = "MACD histogram positive and rising — bullish momentum building"; }
  else if (histogram > 0 && !rising) { signal = "BUY"; score = 35; explanation = "MACD positive but momentum slowing"; }
  else if (histogram < 0 && !rising) { signal = "SELL"; score = -80; explanation = "MACD histogram negative and falling — bearish momentum"; }
  else if (histogram < 0 && rising) { signal = "SELL"; score = -35; explanation = "MACD negative but showing potential recovery"; }
  else { explanation = "MACD neutral"; }

  return { indicator: "MACD", rawValue: histogram.toFixed(4), signal, score, weight: 1, contribution: 0, explanation };
}

function bbScore(closes: number[], currentPrice: number): FactorScore {
  const results = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const band = results[results.length - 1];
  if (!band) return { indicator: "BB", rawValue: 0, signal: "NEUTRAL", score: 0, weight: 1, contribution: 0, explanation: "Insufficient data" };

  const range = band.upper - band.lower;
  const position = (currentPrice - band.lower) / range; // 0 = at lower, 1 = at upper
  const width = range / band.middle; // bandwidth as % of midline

  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let score = 0;
  let explanation = "";

  if (position <= 0.1) { signal = "BUY"; score = 85; explanation = `Price at Bollinger lower band — mean reversion buy signal (width: ${(width * 100).toFixed(1)}%)`; }
  else if (position <= 0.25) { signal = "BUY"; score = 50; explanation = "Price near lower Bollinger band — moderate buy zone"; }
  else if (position >= 0.9) { signal = "SELL"; score = -85; explanation = `Price at Bollinger upper band — mean reversion sell signal`; }
  else if (position >= 0.75) { signal = "SELL"; score = -50; explanation = "Price near upper Bollinger band — moderate sell zone"; }
  else { score = 0; explanation = `Price mid-Bollinger (${(position * 100).toFixed(0)}% position) — neutral`; }

  return { indicator: "BB", rawValue: position.toFixed(3), signal, score, weight: 1, contribution: 0, explanation };
}

function emaScore(closes: number[]): FactorScore {
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const fast = ema20[ema20.length - 1];
  const slow = ema50[ema50.length - 1];
  const prevFast = ema20[ema20.length - 2];
  const prevSlow = ema50[ema50.length - 2];

  const crossedUp = prevFast <= prevSlow && fast > slow;
  const crossedDown = prevFast >= prevSlow && fast < slow;
  const gap = ((fast - slow) / slow) * 100;

  let signal: "BUY" | "SELL" | "NEUTRAL" = fast > slow ? "BUY" : "SELL";
  let score = 0;
  let explanation = "";

  if (crossedUp) { score = 90; explanation = `EMA20 crossed above EMA50 — golden cross, strong bullish signal`; }
  else if (crossedDown) { score = -90; explanation = `EMA20 crossed below EMA50 — death cross, strong bearish signal`; }
  else if (fast > slow) { score = Math.min(60, gap * 10); explanation = `EMA20 (${fast.toFixed(2)}) above EMA50 (${slow.toFixed(2)}) — uptrend (gap: ${gap.toFixed(2)}%)`; }
  else { score = Math.max(-60, gap * 10); explanation = `EMA20 below EMA50 — downtrend (gap: ${Math.abs(gap).toFixed(2)}%)`; }

  return { indicator: "EMA", rawValue: `${fast.toFixed(2)}/${slow.toFixed(2)}`, signal, score, weight: 1, contribution: 0, explanation };
}

function momentumScore(closes: number[]): FactorScore {
  const returns = closes.slice(-7).map((c, i, arr) => i === 0 ? 0 : (c - arr[i - 1]) / arr[i - 1] * 100);
  const avgReturn = returns.slice(1).reduce((a, b) => a + b, 0) / 6;
  const score = Math.max(-100, Math.min(100, avgReturn * 10));
  const signal: "BUY" | "SELL" | "NEUTRAL" = avgReturn > 1 ? "BUY" : avgReturn < -1 ? "SELL" : "NEUTRAL";
  return {
    indicator: "MOMENTUM",
    rawValue: avgReturn.toFixed(2) + "%",
    signal, score, weight: 1, contribution: 0,
    explanation: `7-day average daily return: ${avgReturn.toFixed(2)}%`,
  };
}

function fearGreedScore(value: number, label: string): FactorScore {
  let score = 0;
  let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let explanation = "";

  // Contrarian: extreme fear = buy, extreme greed = sell
  if (value <= 20) { signal = "BUY"; score = 80; explanation = `Extreme Fear (${value}) — market oversold, contrarian buy opportunity`; }
  else if (value <= 35) { signal = "BUY"; score = 45; explanation = `Fear (${value}) — below market sentiment, mild buy`; }
  else if (value >= 80) { signal = "SELL"; score = -80; explanation = `Extreme Greed (${value}) — market overextended, contrarian sell`; }
  else if (value >= 65) { signal = "SELL"; score = -45; explanation = `Greed (${value}) — elevated sentiment, caution`; }
  else { explanation = `Neutral sentiment (${value} — ${label})`; }

  return { indicator: "FEAR_GREED", rawValue: value, signal, score, weight: 1, contribution: 0, explanation };
}

function volumeScore(ratio: number, trend: string): FactorScore {
  let score = 0;
  const signal: "BUY" | "SELL" | "NEUTRAL" = trend === "INCREASING" ? "BUY" : "NEUTRAL";
  if (trend === "INCREASING") { score = 40; }
  else if (trend === "DECREASING") { score = -20; }
  return {
    indicator: "VOLUME",
    rawValue: `${ratio.toFixed(2)}x avg`,
    signal, score, weight: 1, contribution: 0,
    explanation: `Volume is ${(ratio * 100).toFixed(0)}% of 7-day average (${trend})`,
  };
}

function newsScore(sentimentScore: number): FactorScore {
  const score = sentimentScore * 60;
  const signal: "BUY" | "SELL" | "NEUTRAL" = sentimentScore > 0.2 ? "BUY" : sentimentScore < -0.2 ? "SELL" : "NEUTRAL";
  return {
    indicator: "NEWS",
    rawValue: sentimentScore.toFixed(2),
    signal, score: Math.round(score), weight: 1, contribution: 0,
    explanation: `News sentiment score: ${sentimentScore > 0 ? "+" : ""}${sentimentScore.toFixed(2)} (${signal})`,
  };
}

function calculateRisk(price: number, signal: "BUY" | "SELL"): { stopLoss: number; takeProfit: number; rrr: number } {
  const stopPct = 0.025; // 2.5% stop loss
  const rrr = 2.5;       // 2.5:1 risk-reward

  if (signal === "BUY") {
    const stopLoss = price * (1 - stopPct);
    const takeProfit = price + (price - stopLoss) * rrr;
    return { stopLoss, takeProfit, rrr };
  } else {
    const stopLoss = price * (1 + stopPct);
    const takeProfit = price - (stopLoss - price) * rrr;
    return { stopLoss, takeProfit, rrr };
  }
}

export async function analyzeSymbol(symbol: string, userId?: string): Promise<IntelligenceReport | null> {
  const [market, fearGreed, news, volume] = await Promise.all([
    getMarketData(symbol),
    getFearGreedIndex(),
    getNewsSentiment(symbol),
    getVolumeTrend(symbol),
  ]);

  if (!market || market.priceHistory.length < 60) return null;

  const closes = market.priceHistory;
  const price = market.price;

  // Calculate all factor scores
  const rawFactors: FactorScore[] = [
    rsiScore(closes),
    macdScore(closes),
    bbScore(closes, price),
    emaScore(closes),
    momentumScore(closes),
    fearGreedScore(fearGreed.value, fearGreed.classification),
    volumeScore(volume.ratio, volume.trend),
    newsScore(news.score),
  ];

  // Apply learned weights
  const weights = userId ? await getUserWeights(userId) : DEFAULT_WEIGHTS;
  const factors = rawFactors.map((f) => {
    const w = weights[f.indicator] ?? 1;
    return { ...f, weight: w, contribution: f.score * w };
  });

  const totalWeight = factors.reduce((a, f) => a + Math.abs(f.weight), 0);
  const weightedSum = factors.reduce((a, f) => a + f.contribution, 0);
  const finalScore = Math.round(weightedSum / totalWeight);
  const confidence = Math.min(100, Math.round(Math.abs(finalScore)));

  let recommendation: IntelligenceReport["recommendation"] = "HOLD";
  let side: "BUY" | "SELL" | null = null;
  if (finalScore >= 60) { recommendation = "STRONG_BUY"; side = "BUY"; }
  else if (finalScore >= 25) { recommendation = "BUY"; side = "BUY"; }
  else if (finalScore <= -60) { recommendation = "STRONG_SELL"; side = "SELL"; }
  else if (finalScore <= -25) { recommendation = "SELL"; side = "SELL"; }

  const riskCalc = side ? calculateRisk(price, side) : { stopLoss: 0, takeProfit: 0, rrr: 0 };

  // Position sizing: risk 1-2% of balance per trade (Kelly-inspired)
  const positionSizePct = Math.min(2, Math.max(0.5, confidence / 50));

  const fearLabel = fearGreed.classification;
  const marketCondition =
    fearGreed.value <= 25 ? "Extreme Fear — high uncertainty, elevated volatility expected" :
    fearGreed.value >= 75 ? "Extreme Greed — market overextended, pullback risk elevated" :
    market.change24h > 5 ? "Strong bullish momentum in last 24h" :
    market.change24h < -5 ? "Strong bearish pressure in last 24h" :
    "Stable market conditions";

  const topFactor = [...factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const summary = side
    ? `${recommendation.replace("_", " ")} on ${symbol.replace("USDT", "/USDT")} — confidence ${confidence}%. ` +
      `Primary driver: ${topFactor?.explanation}. ` +
      `Entry $${price.toFixed(2)}, stop $${riskCalc.stopLoss.toFixed(2)}, target $${riskCalc.takeProfit.toFixed(2)}.`
    : `No clear edge on ${symbol.replace("USDT", "/USDT")} right now. Mixed signals — best to wait for clarity.`;

  return {
    symbol,
    price,
    finalScore,
    confidence,
    recommendation,
    side,
    entryPrice: price,
    stopLoss: riskCalc.stopLoss,
    takeProfit: riskCalc.takeProfit,
    riskRewardRatio: riskCalc.rrr,
    positionSizePct,
    factors,
    summary,
    marketCondition,
    fearGreedValue: fearGreed.value,
    fearGreedLabel: fearLabel,
    analysedAt: new Date(),
  };
}

// Update learned weights after a trade closes (win/loss)
export async function recordOutcome(userId: string, proposalId: string, won: boolean) {
  const proposal = await prisma.tradeProposal.findUnique({
    where: { id: proposalId },
    select: { reasoning: true },
  });
  if (!proposal) return;

  const reasoning = proposal.reasoning as Record<string, unknown>;
  const factors = (reasoning.factors ?? []) as Array<{ indicator: string }>;

  await Promise.all(
    factors.map((f) =>
      prisma.signalWeight.upsert({
        where: { userId_indicator: { userId, indicator: f.indicator } },
        update: won
          ? { wins: { increment: 1 } }
          : { losses: { increment: 1 } },
        create: { userId, indicator: f.indicator, wins: won ? 1 : 0, losses: won ? 0 : 1 },
      })
    )
  );
}
