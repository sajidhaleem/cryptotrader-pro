import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockAxios = vi.mocked(axios);

import {
  getPriceCG,
  getPricesCG,
  get24hrStatsCG,
  get24hrStatsBatchCG,
  getKlinesCG,
  getKlinesBybit,
  getFearGreedIndex,
  getNewsSentiment,
  COINGECKO_IDS,
} from "../../src/lib/market-data";

// CoinGecko calls go through native fetch (the cg() helper); Bybit still uses axios.
const fetchMock = vi.fn();
const fakeJson = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("COINGECKO_IDS", () => {
  it("maps all major trading pairs", () => {
    expect(COINGECKO_IDS["BTCUSDT"]).toBe("bitcoin");
    expect(COINGECKO_IDS["ETHUSDT"]).toBe("ethereum");
    expect(COINGECKO_IDS["SOLUSDT"]).toBe("solana");
    expect(COINGECKO_IDS["BNBUSDT"]).toBe("binancecoin");
    expect(COINGECKO_IDS["ADAUSDT"]).toBe("cardano");
    expect(COINGECKO_IDS["XRPUSDT"]).toBe("ripple");
  });

  it("has at least 12 pairs", () => {
    expect(Object.keys(COINGECKO_IDS).length).toBeGreaterThanOrEqual(12);
  });
});

describe("getPriceCG", () => {
  it("returns the USD price for a supported symbol", async () => {
    fetchMock.mockResolvedValue(fakeJson({ bitcoin: { usd: 65000 } }));

    const price = await getPriceCG("BTCUSDT");
    expect(price).toBe(65000);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("simple/price");
    expect(url).toContain("ids=bitcoin");
  });

  it("throws for an unsupported symbol", async () => {
    await expect(getPriceCG("FAKECOIN")).rejects.toThrow("Unsupported symbol");
  });
});

describe("getPricesCG", () => {
  it("returns prices for multiple symbols", async () => {
    fetchMock.mockResolvedValue(fakeJson({ bitcoin: { usd: 65000 }, ethereum: { usd: 3500 } }));

    const prices = await getPricesCG(["BTCUSDT", "ETHUSDT"]);
    expect(prices["BTCUSDT"]).toBe(65000);
    expect(prices["ETHUSDT"]).toBe(3500);
  });

  it("silently skips unsupported symbols", async () => {
    fetchMock.mockResolvedValue(fakeJson({ bitcoin: { usd: 65000 } }));

    const prices = await getPricesCG(["BTCUSDT", "FAKECOIN"]);
    expect(prices["BTCUSDT"]).toBe(65000);
    expect(prices["FAKECOIN"]).toBeUndefined();
  });

  it("passes comma-joined IDs to CoinGecko", async () => {
    fetchMock.mockResolvedValue(fakeJson({ bitcoin: { usd: 65000 }, solana: { usd: 150 } }));

    await getPricesCG(["BTCUSDT", "SOLUSDT"]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("bitcoin");
    expect(url).toContain("solana");
  });
});

describe("get24hrStatsCG", () => {
  it("returns correct stats shape", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      bitcoin: {
        usd: 65000,
        usd_24h_change: 2.5,
        usd_24h_vol: 45_000_000_000,
      },
    }));

    const stats = await get24hrStatsCG("BTCUSDT");
    expect(stats.symbol).toBe("BTCUSDT");
    expect(stats.price).toBe(65000);
    expect(stats.priceChangePercent).toBe(2.5);
    expect(stats.quoteVolume).toBe(45_000_000_000);
    expect(stats.high).toBeGreaterThan(stats.low);
  });

  it("high is 1% above price and low is 1% below", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      ethereum: { usd: 3500, usd_24h_change: -1, usd_24h_vol: 1e10 },
    }));

    const stats = await get24hrStatsCG("ETHUSDT");
    expect(stats.high).toBeCloseTo(3500 * 1.01, 2);
    expect(stats.low).toBeCloseTo(3500 * 0.99, 2);
  });
});

describe("get24hrStatsBatchCG", () => {
  it("returns stats for multiple symbols", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      bitcoin: { usd: 65000, usd_24h_change: 2.5 },
      ethereum: { usd: 3500, usd_24h_change: -1.2 },
    }));

    const batch = await get24hrStatsBatchCG(["BTCUSDT", "ETHUSDT"]);
    expect(batch["BTCUSDT"].price).toBe(65000);
    expect(batch["BTCUSDT"].priceChangePercent).toBe(2.5);
    expect(batch["ETHUSDT"].price).toBe(3500);
    expect(batch["ETHUSDT"].priceChangePercent).toBe(-1.2);
  });

  it("skips unsupported symbols", async () => {
    fetchMock.mockResolvedValue(fakeJson({}));
    const batch = await get24hrStatsBatchCG(["FAKECOIN"]);
    expect(Object.keys(batch)).toHaveLength(0);
  });
});

describe("getKlinesCG — 1h interval", () => {
  const makeHourlyResponse = (count: number) => ({
    prices: Array.from({ length: count }, (_, i) => [1700000000000 + i * 3600e3, 50000 + i * 10] as [number, number]),
    total_volumes: Array.from({ length: count }, (_, i) => [1700000000000 + i * 3600e3, 1e9] as [number, number]),
  });

  it("returns Kline array for 1h interval", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeHourlyResponse(200)));
    const klines = await getKlinesCG("BTCUSDT", "1h", 100);
    expect(klines).toHaveLength(100);
    expect(klines[0]).toMatchObject({ open: expect.any(Number), high: expect.any(Number), low: expect.any(Number), close: expect.any(Number), volume: expect.any(Number) });
  });

  it("high >= close and low <= close", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeHourlyResponse(100)));
    const klines = await getKlinesCG("BTCUSDT", "1h", 50);
    for (const k of klines) {
      expect(k.high).toBeGreaterThanOrEqual(k.close);
      expect(k.low).toBeLessThanOrEqual(k.close);
    }
  });

  it("uses market_chart endpoint for 1h", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeHourlyResponse(50)));
    await getKlinesCG("ETHUSDT", "1h", 24);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("market_chart");
  });
});

describe("getKlinesCG — 4h interval", () => {
  const makeOhlcResponse = (count: number) =>
    Array.from({ length: count }, (_, i) => [
      1700000000000 + i * 4 * 3600e3, // time
      49000 + i * 50,                 // open
      50000 + i * 50,                 // high
      48000 + i * 50,                 // low
      49500 + i * 50,                 // close
    ] as [number, number, number, number, number]);

  it("returns Kline array for 4h interval", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeOhlcResponse(150)));
    const klines = await getKlinesCG("BTCUSDT", "4h", 100);
    expect(klines.length).toBeLessThanOrEqual(100);
    expect(klines[0].high).toBeGreaterThan(klines[0].low);
  });

  it("uses ohlc endpoint for 4h", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeOhlcResponse(50)));
    await getKlinesCG("BTCUSDT", "4h", 50);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/ohlc");
  });
});

describe("getKlinesCG — 1d interval", () => {
  const makeDailyResponse = (count: number) => ({
    prices: Array.from({ length: count }, (_, i) => [1700000000000 + i * 86400e3, 50000 + i * 10] as [number, number]),
    total_volumes: Array.from({ length: count }, (_, i) => [1700000000000 + i * 86400e3, 1e9] as [number, number]),
  });

  it("returns Kline array for 1d interval", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeDailyResponse(120)));
    const klines = await getKlinesCG("BTCUSDT", "1d", 100);
    expect(klines.length).toBeLessThanOrEqual(100);
  });

  it("uses market_chart endpoint for 1d", async () => {
    fetchMock.mockResolvedValue(fakeJson(makeDailyResponse(120)));
    await getKlinesCG("BTCUSDT", "1d", 100);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("market_chart");
  });
});

describe("getKlinesCG — unsupported symbol", () => {
  it("throws for unsupported symbol", async () => {
    await expect(getKlinesCG("FAKECOIN", "1h", 50)).rejects.toThrow("Unsupported symbol");
  });
});

describe("getKlinesBybit", () => {
  function makeBybitResponse(count: number) {
    // Bybit returns newest-first: [timestamp, open, high, low, close, volume, turnover]
    const list = Array.from({ length: count }, (_, i) => [
      String(1700000000000 - (count - 1 - i) * 86400e3),
      "49000", "51000", "48000", "50000", "1000", "50000000",
    ] as [string, string, string, string, string, string, string]).reverse();
    return { retCode: 0, retMsg: "OK", result: { list } };
  }

  const emptyBybit = { retCode: 0, retMsg: "OK", result: { list: [] } };

  it("returns Kline array in chronological order (spot succeeds)", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeBybitResponse(200) });
    const klines = await getKlinesBybit("BTCUSDT", "1d", 200);
    expect(klines).toHaveLength(200);
    expect(klines[0].openTime).toBeLessThan(klines[1].openTime);
  });

  it("maps OHLCV fields correctly", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeBybitResponse(10) });
    const klines = await getKlinesBybit("BTCUSDT", "1d", 10);
    expect(klines[0].open).toBe(49000);
    expect(klines[0].high).toBe(51000);
    expect(klines[0].low).toBe(48000);
    expect(klines[0].close).toBe(50000);
    expect(klines[0].volume).toBe(1000);
  });

  it("falls back to linear when spot returns empty list", async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce({ data: emptyBybit })            // spot empty
      .mockResolvedValueOnce({ data: makeBybitResponse(50) }); // linear ok
    const klines = await getKlinesBybit("BTCUSDT", "1d", 50);
    expect(klines).toHaveLength(50);
  });

  it("throws when both spot and linear return empty", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: emptyBybit });
    await expect(getKlinesBybit("INVALID", "1d", 100)).rejects.toThrow("Bybit: no data");
  });

  it("calls Bybit endpoint (not CoinGecko)", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeBybitResponse(10) });
    await getKlinesBybit("BTCUSDT", "1d", 10);
    const url = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("bybit.com");
  });
});

describe("getFearGreedIndex", () => {
  it("returns value and classification from Alternative.me", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      data: [{ value: "25", value_classification: "Fear" }],
    }));

    const result = await getFearGreedIndex();
    expect(result.value).toBe(25);
    expect(result.classification).toBe("Fear");
  });

  it("returns neutral defaults on fetch failure", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    const result = await getFearGreedIndex();
    expect(result.value).toBe(50);
    expect(result.classification).toBe("Neutral");
  });
});

describe("getNewsSentiment", () => {
  it("returns score 0 and empty items on failure", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("calculates positive score when most news is positive", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      results: [
        { title: "Bitcoin hits ATH", votes: { positive: 10, negative: 1 }, published_at: "2025-01-01", url: "u1" },
        { title: "BTC gains", votes: { positive: 8, negative: 1 }, published_at: "2025-01-01", url: "u2" },
        { title: "Crypto boom", votes: { positive: 12, negative: 0 }, published_at: "2025-01-01", url: "u3" },
      ],
    }));

    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBeGreaterThan(0);
    expect(result.items).toHaveLength(3);
  });

  it("calculates negative score when most news is negative", async () => {
    fetchMock.mockResolvedValue(fakeJson({
      results: [
        { title: "BTC crashes", votes: { positive: 1, negative: 10 }, published_at: "2025-01-01", url: "u1" },
        { title: "Crypto winter", votes: { positive: 0, negative: 15 }, published_at: "2025-01-01", url: "u2" },
      ],
    }));

    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBeLessThan(0);
  });
});
