import { RSI, MACD, BollingerBands, EMA, SMA } from "technicalindicators";

export type SignalType = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export interface TechnicalSignal {
  signal: SignalType;
  strength: number; // 0-100
  rsi: number;
  macd: { value: number; signal: number; histogram: number } | null;
  bb: { upper: number; middle: number; lower: number } | null;
  ema20: number;
  ema50: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  summary: string;
  indicators: {
    name: string;
    value: string;
    signal: "BUY" | "SELL" | "NEUTRAL";
  }[];
}

export function analyzeSignals(closes: number[]): TechnicalSignal {
  if (closes.length < 50) {
    return {
      signal: "HOLD",
      strength: 50,
      rsi: 50,
      macd: null,
      bb: null,
      ema20: closes[closes.length - 1],
      ema50: closes[closes.length - 1],
      trend: "NEUTRAL",
      summary: "Insufficient data for analysis",
      indicators: [],
    };
  }

  // RSI
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const rsi = rsiValues[rsiValues.length - 1] ?? 50;

  // MACD
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLast = macdResult[macdResult.length - 1];
  const macd = macdLast
    ? {
        value: macdLast.MACD ?? 0,
        signal: macdLast.signal ?? 0,
        histogram: macdLast.histogram ?? 0,
      }
    : null;

  // Bollinger Bands
  const bbResult = BollingerBands.calculate({
    values: closes,
    period: 20,
    stdDev: 2,
  });
  const bbLast = bbResult[bbResult.length - 1];
  const bb = bbLast
    ? { upper: bbLast.upper, middle: bbLast.middle, lower: bbLast.lower }
    : null;

  // EMAs
  const ema20Values = EMA.calculate({ values: closes, period: 20 });
  const ema50Values = EMA.calculate({ values: closes, period: 50 });
  const ema20 = ema20Values[ema20Values.length - 1] ?? closes[closes.length - 1];
  const ema50 = ema50Values[ema50Values.length - 1] ?? closes[closes.length - 1];

  const currentPrice = closes[closes.length - 1];

  // Score signals
  let score = 0;
  const indicators: TechnicalSignal["indicators"] = [];

  // RSI scoring
  if (rsi < 30) {
    score += 2;
    indicators.push({ name: "RSI", value: rsi.toFixed(1), signal: "BUY" });
  } else if (rsi < 45) {
    score += 1;
    indicators.push({ name: "RSI", value: rsi.toFixed(1), signal: "BUY" });
  } else if (rsi > 70) {
    score -= 2;
    indicators.push({ name: "RSI", value: rsi.toFixed(1), signal: "SELL" });
  } else if (rsi > 55) {
    score -= 1;
    indicators.push({ name: "RSI", value: rsi.toFixed(1), signal: "SELL" });
  } else {
    indicators.push({ name: "RSI", value: rsi.toFixed(1), signal: "NEUTRAL" });
  }

  // MACD scoring
  if (macd) {
    if (macd.histogram > 0 && macd.value > macd.signal) {
      score += 2;
      indicators.push({
        name: "MACD",
        value: macd.histogram.toFixed(4),
        signal: "BUY",
      });
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      score -= 2;
      indicators.push({
        name: "MACD",
        value: macd.histogram.toFixed(4),
        signal: "SELL",
      });
    } else {
      indicators.push({
        name: "MACD",
        value: macd.histogram.toFixed(4),
        signal: "NEUTRAL",
      });
    }
  }

  // BB scoring
  if (bb) {
    if (currentPrice < bb.lower) {
      score += 2;
      indicators.push({
        name: "Bollinger Bands",
        value: "Below Lower",
        signal: "BUY",
      });
    } else if (currentPrice > bb.upper) {
      score -= 2;
      indicators.push({
        name: "Bollinger Bands",
        value: "Above Upper",
        signal: "SELL",
      });
    } else {
      indicators.push({
        name: "Bollinger Bands",
        value: "Within Bands",
        signal: "NEUTRAL",
      });
    }
  }

  // EMA scoring
  if (ema20 > ema50) {
    score += 1;
    indicators.push({ name: "EMA Cross", value: "20 > 50", signal: "BUY" });
  } else if (ema20 < ema50) {
    score -= 1;
    indicators.push({ name: "EMA Cross", value: "20 < 50", signal: "SELL" });
  } else {
    indicators.push({ name: "EMA Cross", value: "Neutral", signal: "NEUTRAL" });
  }

  // Price vs EMA50
  if (currentPrice > ema50) {
    score += 1;
    indicators.push({ name: "Price vs EMA50", value: "Above", signal: "BUY" });
  } else {
    score -= 1;
    indicators.push({ name: "Price vs EMA50", value: "Below", signal: "SELL" });
  }

  // Determine signal
  let signal: SignalType;
  let strength: number;
  let summary: string;

  if (score >= 6) {
    signal = "STRONG_BUY";
    strength = 90;
    summary = "Strong bullish momentum across all indicators";
  } else if (score >= 3) {
    signal = "BUY";
    strength = 70;
    summary = "Bullish signals dominate — consider entering a long position";
  } else if (score <= -6) {
    signal = "STRONG_SELL";
    strength = 10;
    summary = "Strong bearish pressure — consider exiting or shorting";
  } else if (score <= -3) {
    signal = "SELL";
    strength = 30;
    summary = "Bearish signals dominate — caution advised";
  } else {
    signal = "HOLD";
    strength = 50;
    summary = "Mixed signals — wait for a clearer direction";
  }

  const trend: TechnicalSignal["trend"] =
    score > 1 ? "BULLISH" : score < -1 ? "BEARISH" : "NEUTRAL";

  return {
    signal,
    strength,
    rsi,
    macd,
    bb,
    ema20,
    ema50,
    trend,
    summary,
    indicators,
  };
}
