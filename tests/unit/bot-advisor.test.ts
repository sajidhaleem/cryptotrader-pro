import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

// Anthropic must be mocked as a proper class (arrow functions can't be used with `new`)
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropicClass = vi.fn(function MockAnthropic() {
    (this as { messages: { create: typeof mockCreate } }).messages = { create: mockCreate };
  });
  return { default: MockAnthropicClass };
});

vi.mock("../../src/lib/news-feed", () => ({
  fetchNewsContext: vi.fn().mockResolvedValue({
    headlines: [],
    sentiment: "NEUTRAL",
    sentimentScore: 0,
    bullishCount: 0,
    bearishCount: 0,
    sources: [],
  }),
}));

const mockAxios = vi.mocked(axios);

import { getBotRecommendation } from "../../src/lib/bot-advisor";

// Build mock CoinGecko responses
function makeHourlyData(count: number, price = 50000) {
  return {
    prices: Array.from({ length: count }, (_, i) => [Date.now() + i * 3600e3, price + i * 10] as [number, number]),
    total_volumes: Array.from({ length: count }, (_, i) => [Date.now() + i * 3600e3, 1e9] as [number, number]),
  };
}

function makeOhlcData(count: number, price = 50000): [number, number, number, number, number][] {
  return Array.from({ length: count }, (_, i) => [
    Date.now() + i * 4 * 3600e3,
    price - 100, price + 200, price - 200, price + 50,
  ]);
}

function makePriceData(coinId: string, price = 50000) {
  return { [coinId]: { usd: price, usd_24h_change: 2.5 } };
}

const VALID_RECOMMENDATION = JSON.stringify({
  strategy: "DCA",
  name: "BTC Safe DCA",
  config: { amount: 50, interval: "4h" },
  rationale: "Market is neutral, DCA is safest.",
  marketPhase: "ACCUMULATION",
  confidence: 70,
  safetyNotes: ["Use paper mode first", "Start small", "Monitor weekly"],
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Default CoinGecko call sequence: market_chart → ohlc → simple/price
  // Match any coinId in simple/price response so both BTC and ETH tests work
  mockAxios.get = vi.fn().mockImplementation(async (url: string, opts?: { params?: { ids?: string } }) => {
    if (url.includes("bybit.com")) {
      // Bybit 4h kline response (newest-first list)
      const list = makeOhlcData(100).map(([t, o, h, l, c]) => [
        String(t), String(o), String(h), String(l), String(c), "1000", "50000000",
      ]);
      return { data: { retCode: 0, retMsg: "OK", result: { list } } };
    }
    if (url.includes("market_chart")) return { data: makeHourlyData(200) };
    if (url.includes("/ohlc")) return { data: makeOhlcData(50) };
    if (url.includes("simple/price")) {
      const coinId = opts?.params?.ids ?? "bitcoin";
      return { data: makePriceData(coinId) };
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: VALID_RECOMMENDATION }],
  });

  process.env.ANTHROPIC_API_KEY = "test-api-key";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("getBotRecommendation — happy path", () => {
  it("returns a full BotRecommendation for BTCUSDT", async () => {
    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect(rec.symbol).toBe("BTCUSDT");
    expect(rec.strategy).toMatch(/^(DCA|RSI|MACD|GRID)$/);
    expect(rec.confidence).toBeGreaterThanOrEqual(50);
    expect(rec.confidence).toBeLessThanOrEqual(92);
    expect(rec.safetyNotes).toBeInstanceOf(Array);
    expect(rec.rawMarketData).toBeDefined();
  });

  it("makes exactly 3 CoinGecko API calls", async () => {
    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    await recPromise;
    expect(mockAxios.get).toHaveBeenCalledTimes(3);
  });

  it("calls Claude with market snapshot in the prompt", async () => {
    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    await recPromise;

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toContain("haiku");
    expect(call.messages[0].content).toContain("BTCUSDT");
    expect(call.messages[0].content).toContain("Price:");
  });

  it("strips markdown code fences from Claude response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + VALID_RECOMMENDATION + "\n```" }],
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect(rec.strategy).toBe("DCA");
  });
});

describe("getBotRecommendation — safety enforcement", () => {
  it("bumps amount up to $15 when Claude returns amount < $15", async () => {
    const unsafe = { ...JSON.parse(VALID_RECOMMENDATION), config: { amount: 8, interval: "4h" } };
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(unsafe) }],
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect((rec.config as { amount: number }).amount).toBeGreaterThanOrEqual(15);
  });

  it("upgrades interval from 30m to 1h for non-DCA strategies", async () => {
    const unsafe = {
      ...JSON.parse(VALID_RECOMMENDATION),
      strategy: "RSI",
      config: { amount: 50, interval: "30m" },
    };
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(unsafe) }],
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect((rec.config as { interval: string }).interval).toBe("1h");
  });

  it("allows 30m interval for DCA strategy", async () => {
    const safe = {
      ...JSON.parse(VALID_RECOMMENDATION),
      strategy: "DCA",
      config: { amount: 50, interval: "30m" },
    };
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(safe) }],
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect((rec.config as { interval: string }).interval).toBe("30m");
  });
});

describe("getBotRecommendation — error handling", () => {
  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(getBotRecommendation("BTCUSDT")).rejects.toThrow("ANTHROPIC_API_KEY");
  });

  it("throws for unsupported symbol", async () => {
    await expect(getBotRecommendation("FAKECOIN")).rejects.toThrow("Unsupported crypto symbol");
  });

  it("retries once on 429 from CoinGecko", async () => {
    const err429 = Object.assign(new Error("rate limited"), { response: { status: 429 } });
    let calls = 0;
    mockAxios.get = vi.fn().mockImplementation(async (url: string) => {
      calls++;
      if (calls === 1) throw err429; // first call fails with 429
      if (url.includes("market_chart")) return { data: makeHourlyData(200) };
      if (url.includes("/ohlc")) return { data: makeOhlcData(50) };
      if (url.includes("simple/price")) return { data: makePriceData("bitcoin") };
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect(rec).toBeDefined();
    expect(calls).toBeGreaterThan(3); // 1 fail + 1 retry + 2 more calls = 4+
  });

  it("throws when Claude returns non-text content", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "image", source: { type: "base64", data: "abc" } }],
    });

    const recPromise = getBotRecommendation("BTCUSDT");
    // Attach rejection handler BEFORE advancing timers to prevent unhandled rejection warning
    const expectation = expect(recPromise).rejects.toThrow("Unexpected Claude response type");
    await vi.runAllTimersAsync();
    await expectation;
  });
});

describe("getBotRecommendation — market snapshot calculation", () => {
  it("rawMarketData contains all required fields", async () => {
    const recPromise = getBotRecommendation("BTCUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    const snap = rec.rawMarketData;
    expect(snap).toMatchObject({
      price: expect.any(Number),
      adx: expect.any(Number),
      rsi1h: expect.any(Number),
      rsi4h: expect.any(Number),
      bbWidth: expect.any(Number),
      bbPosition: expect.any(Number),
      macdHistogram: expect.any(Number),
      macdBullish: expect.any(Boolean),
      volumeRatio: expect.any(Number),
      change24h: expect.any(Number),
    });
  });

  it("rsi1h and rsi4h are between 0 and 100", async () => {
    const recPromise = getBotRecommendation("ETHUSDT");
    await vi.runAllTimersAsync();
    const rec = await recPromise;

    expect(rec.rawMarketData.rsi1h).toBeGreaterThanOrEqual(0);
    expect(rec.rawMarketData.rsi1h).toBeLessThanOrEqual(100);
    expect(rec.rawMarketData.rsi4h).toBeGreaterThanOrEqual(0);
    expect(rec.rawMarketData.rsi4h).toBeLessThanOrEqual(100);
  });
});
