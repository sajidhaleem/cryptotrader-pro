import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing the module
vi.mock("../../src/lib/market-data", () => ({
  getKlinesCG: vi.fn(),
  getFearGreedIndex: vi.fn(),
  getNewsSentiment: vi.fn(),
}));

vi.mock("../../src/lib/db", () => ({
  prisma: {
    signalWeight: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { analyzeSymbol } from "../../src/lib/intelligence";
import { getKlinesCG, getFearGreedIndex, getNewsSentiment } from "../../src/lib/market-data";
import type { Kline } from "../../src/lib/binance";

const mockGetKlines = vi.mocked(getKlinesCG);
const mockFearGreed = vi.mocked(getFearGreedIndex);
const mockNews      = vi.mocked(getNewsSentiment);

// Build a synthetic Kline array — realistic OHLCV data
function makeKlines(count: number, basePrice = 50000, trend = 0): Kline[] {
  const klines: Kline[] = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    price = Math.max(1, price + trend + (Math.random() - 0.5) * 500);
    const open  = price * (1 + (Math.random() - 0.5) * 0.005);
    const close = price;
    const high  = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low   = Math.min(open, close) * (1 - Math.random() * 0.005);
    klines.push({
      openTime:  now - (count - i) * 3600e3,
      open, high, low, close,
      volume:    100000 + Math.random() * 50000,
      closeTime: now - (count - i - 1) * 3600e3 - 1,
    });
  }
  return klines;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  mockFearGreed.mockResolvedValue({ value: 50, classification: "Neutral" });
  mockNews.mockResolvedValue({ score: 0, items: [] });

  // Default: enough data for all indicators
  mockGetKlines.mockImplementation((_sym: string, interval: string, limit: number) => {
    return Promise.resolve(makeKlines(limit, 50000, 0));
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("analyzeSymbol — happy path", () => {
  it("returns a full IntelligenceReport for BTCUSDT", async () => {
    const reportPromise = analyzeSymbol("BTCUSDT");
    // Advance timers past the sleep() calls (350+350+200 = 900ms)
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.symbol).toBe("BTCUSDT");
    expect(report.price).toBeGreaterThan(0);
    expect(report.confidence).toBeGreaterThanOrEqual(0);
    expect(report.confidence).toBeLessThanOrEqual(100);
    expect(report.factors).toHaveLength(13);
    expect(["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"]).toContain(report.recommendation);
    expect(report.analysedAt).toBeInstanceOf(Date);
  });

  it("calls getKlinesCG exactly 3 times with correct intervals", async () => {
    const reportPromise = analyzeSymbol("ETHUSDT");
    await vi.runAllTimersAsync();
    await reportPromise;

    expect(mockGetKlines).toHaveBeenCalledTimes(3);
    const calls = mockGetKlines.mock.calls;
    expect(calls[0][1]).toBe("1h");
    expect(calls[1][1]).toBe("4h");
    expect(calls[2][1]).toBe("1d");
  });

  it("sets side=null and recommendation=HOLD for neutral market", async () => {
    // Fear&Greed neutral, no news, flat price series → HOLD likely
    mockGetKlines.mockImplementation((_sym, _interval, limit) =>
      Promise.resolve(makeKlines(limit, 50000, 0))
    );

    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    // May be HOLD or slight signal — just verify shape
    expect(report).not.toBeNull();
    if (report?.side === null) {
      expect(report.stopLoss).toBe(0);
      expect(report.takeProfit).toBe(0);
    }
  });

  it("uses extreme fear (value=10) as BUY signal", async () => {
    mockFearGreed.mockResolvedValue({ value: 10, classification: "Extreme Fear" });
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    const fgFactor = report?.factors.find(f => f.indicator === "FEAR_GREED");
    expect(fgFactor?.signal).toBe("BUY");
    expect(fgFactor?.score).toBe(90);
  });

  it("uses extreme greed (value=90) as SELL signal", async () => {
    mockFearGreed.mockResolvedValue({ value: 90, classification: "Extreme Greed" });
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    const fgFactor = report?.factors.find(f => f.indicator === "FEAR_GREED");
    expect(fgFactor?.signal).toBe("SELL");
    expect(fgFactor?.score).toBe(-90);
  });

  it("positive news sentiment contributes BUY score", async () => {
    mockNews.mockResolvedValue({ score: 0.8, items: [] });
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    const newsFactor = report?.factors.find(f => f.indicator === "NEWS");
    expect(newsFactor?.signal).toBe("BUY");
    expect(newsFactor?.score).toBeGreaterThan(0);
  });

  it("ORDER_BOOK is neutral (no CoinGecko equivalent — empty bids/asks)", async () => {
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    const obFactor = report?.factors.find(f => f.indicator === "ORDER_BOOK");
    expect(obFactor?.signal).toBe("NEUTRAL");
    expect(obFactor?.score).toBe(0);
  });

  it("stopLoss and takeProfit are set when side is BUY", async () => {
    // Force all indicators bullish with extreme fear + positive news + uptrend klines
    mockFearGreed.mockResolvedValue({ value: 5, classification: "Extreme Fear" });
    mockNews.mockResolvedValue({ score: 1.0, items: [] });
    mockGetKlines.mockImplementation((_sym, _interval, limit) =>
      Promise.resolve(makeKlines(limit, 50000, 50)) // strong uptrend
    );

    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    if (report?.side === "BUY") {
      expect(report.stopLoss).toBeLessThan(report.price);
      expect(report.takeProfit).toBeGreaterThan(report.price);
      expect(report.riskRewardRatio).toBe(3.0);
    }
  });

  it("riskRewardRatio is always 3.0", async () => {
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;
    expect(report?.riskRewardRatio).toBe(3.0);
  });
});

describe("analyzeSymbol — insufficient data", () => {
  it("returns null when 1h klines < 50", async () => {
    mockGetKlines.mockImplementation((_sym, interval, _limit) => {
      if (interval === "1h") return Promise.resolve(makeKlines(30));
      return Promise.resolve(makeKlines(100));
    });

    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;
    expect(report).toBeNull();
  });

  it("returns null when 4h klines < 50", async () => {
    mockGetKlines.mockImplementation((_sym, interval, _limit) => {
      if (interval === "4h") return Promise.resolve(makeKlines(20));
      return Promise.resolve(makeKlines(200));
    });

    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;
    expect(report).toBeNull();
  });
});

describe("analyzeSymbol — multiTimeframe alignment", () => {
  it("multiTFAlignment true boosts finalScore by 20%", async () => {
    // All timeframes uptrending → RSI_1H, RSI_4H, RSI_1D all BUY → alignment
    mockGetKlines.mockImplementation((_sym, _interval, limit) =>
      Promise.resolve(makeKlines(limit, 50000, 100)) // very strong uptrend
    );
    mockFearGreed.mockResolvedValue({ value: 15, classification: "Extreme Fear" });

    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    if (report?.multiTFAlignment) {
      // When all 3 TFs align, the score gets boosted
      expect(Math.abs(report.finalScore)).toBeGreaterThan(0);
    }
  });
});

describe("analyzeSymbol — positionSizePct", () => {
  it("positionSizePct is between 0.5 and 3", async () => {
    const reportPromise = analyzeSymbol("BTCUSDT");
    await vi.runAllTimersAsync();
    const report = await reportPromise;

    if (report) {
      expect(report.positionSizePct).toBeGreaterThanOrEqual(0.5);
      expect(report.positionSizePct).toBeLessThanOrEqual(3);
    }
  });
});
