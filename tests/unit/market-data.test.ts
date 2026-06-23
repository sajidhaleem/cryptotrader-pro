import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockAxios = vi.mocked(axios);

import {
  getPriceCG,
  getPricesCG,
  get24hrStatsCG,
  get24hrStatsBatchCG,
  getKlinesCG,
  getFearGreedIndex,
  getNewsSentiment,
  COINGECKO_IDS,
} from "../../src/lib/market-data";

beforeEach(() => {
  vi.clearAllMocks();
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

  it("has 12 pairs total", () => {
    expect(Object.keys(COINGECKO_IDS)).toHaveLength(12);
  });
});

describe("getPriceCG", () => {
  it("returns the USD price for a supported symbol", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: { bitcoin: { usd: 65000 } },
    });

    const price = await getPriceCG("BTCUSDT");
    expect(price).toBe(65000);
    expect(mockAxios.get).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/simple/price",
      expect.objectContaining({ params: expect.objectContaining({ ids: "bitcoin" }) })
    );
  });

  it("throws for an unsupported symbol", async () => {
    await expect(getPriceCG("FAKECOIN")).rejects.toThrow("Unsupported symbol");
  });
});

describe("getPricesCG", () => {
  it("returns prices for multiple symbols", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: { bitcoin: { usd: 65000 }, ethereum: { usd: 3500 } },
    });

    const prices = await getPricesCG(["BTCUSDT", "ETHUSDT"]);
    expect(prices["BTCUSDT"]).toBe(65000);
    expect(prices["ETHUSDT"]).toBe(3500);
  });

  it("silently skips unsupported symbols", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: { bitcoin: { usd: 65000 } },
    });

    const prices = await getPricesCG(["BTCUSDT", "FAKECOIN"]);
    expect(prices["BTCUSDT"]).toBe(65000);
    expect(prices["FAKECOIN"]).toBeUndefined();
  });

  it("passes comma-joined IDs to CoinGecko", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: { bitcoin: { usd: 65000 }, solana: { usd: 150 } },
    });

    await getPricesCG(["BTCUSDT", "SOLUSDT"]);
    const params = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][1].params;
    expect(params.ids).toContain("bitcoin");
    expect(params.ids).toContain("solana");
  });
});

describe("get24hrStatsCG", () => {
  it("returns correct stats shape", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: {
        bitcoin: {
          usd: 65000,
          usd_24h_change: 2.5,
          usd_24h_vol: 45_000_000_000,
        },
      },
    });

    const stats = await get24hrStatsCG("BTCUSDT");
    expect(stats.symbol).toBe("BTCUSDT");
    expect(stats.price).toBe(65000);
    expect(stats.priceChangePercent).toBe(2.5);
    expect(stats.quoteVolume).toBe(45_000_000_000);
    expect(stats.high).toBeGreaterThan(stats.low);
  });

  it("high is 1% above price and low is 1% below", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: { ethereum: { usd: 3500, usd_24h_change: -1, usd_24h_vol: 1e10 } },
    });

    const stats = await get24hrStatsCG("ETHUSDT");
    expect(stats.high).toBeCloseTo(3500 * 1.01, 2);
    expect(stats.low).toBeCloseTo(3500 * 0.99, 2);
  });
});

describe("get24hrStatsBatchCG", () => {
  it("returns stats for multiple symbols", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      data: {
        bitcoin: { usd: 65000, usd_24h_change: 2.5 },
        ethereum: { usd: 3500, usd_24h_change: -1.2 },
      },
    });

    const batch = await get24hrStatsBatchCG(["BTCUSDT", "ETHUSDT"]);
    expect(batch["BTCUSDT"].price).toBe(65000);
    expect(batch["BTCUSDT"].priceChangePercent).toBe(2.5);
    expect(batch["ETHUSDT"].price).toBe(3500);
    expect(batch["ETHUSDT"].priceChangePercent).toBe(-1.2);
  });

  it("skips unsupported symbols", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: {} });
    const batch = await get24hrStatsBatchCG(["FAKECOIN"]);
    expect(Object.keys(batch)).toHaveLength(0);
  });
});

describe("getKlinesCG — 1h interval", () => {
  const makeHourlyResponse = (count: number) => ({
    prices: Array.from({ length: count }, (_, i) => [Date.now() + i * 3600e3, 50000 + i * 10] as [number, number]),
    total_volumes: Array.from({ length: count }, (_, i) => [Date.now() + i * 3600e3, 1e9] as [number, number]),
  });

  it("returns Kline array for 1h interval", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeHourlyResponse(200) });
    const klines = await getKlinesCG("BTCUSDT", "1h", 100);
    expect(klines).toHaveLength(100);
    expect(klines[0]).toMatchObject({ open: expect.any(Number), high: expect.any(Number), low: expect.any(Number), close: expect.any(Number), volume: expect.any(Number) });
  });

  it("high >= close and low <= close", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeHourlyResponse(100) });
    const klines = await getKlinesCG("BTCUSDT", "1h", 50);
    for (const k of klines) {
      expect(k.high).toBeGreaterThanOrEqual(k.close);
      expect(k.low).toBeLessThanOrEqual(k.close);
    }
  });

  it("uses market_chart endpoint for 1h", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeHourlyResponse(50) });
    await getKlinesCG("ETHUSDT", "1h", 24);
    const url = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("market_chart");
  });
});

describe("getKlinesCG — 4h interval", () => {
  const makeOhlcResponse = (count: number) =>
    Array.from({ length: count }, (_, i) => [
      Date.now() + i * 4 * 3600e3, // time
      49000 + i * 50,               // open
      50000 + i * 50,               // high
      48000 + i * 50,               // low
      49500 + i * 50,               // close
    ] as [number, number, number, number, number]);

  it("returns Kline array for 4h interval", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeOhlcResponse(150) });
    const klines = await getKlinesCG("BTCUSDT", "4h", 100);
    expect(klines.length).toBeLessThanOrEqual(100);
    expect(klines[0].high).toBeGreaterThan(klines[0].low);
  });

  it("uses ohlc endpoint for 4h", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeOhlcResponse(50) });
    await getKlinesCG("BTCUSDT", "4h", 50);
    const url = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/ohlc");
  });
});

describe("getKlinesCG — 1d interval", () => {
  const makeOhlcResponse = (count: number) =>
    Array.from({ length: count }, (_, i) => [
      Date.now() + i * 86400e3,
      49000, 51000, 48000, 50000,
    ] as [number, number, number, number, number]);

  it("returns Kline array for 1d interval", async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: makeOhlcResponse(110) });
    const klines = await getKlinesCG("BTCUSDT", "1d", 100);
    expect(klines.length).toBeLessThanOrEqual(100);
  });
});

describe("getKlinesCG — unsupported symbol", () => {
  it("throws for unsupported symbol", async () => {
    await expect(getKlinesCG("FAKECOIN", "1h", 50)).rejects.toThrow("Unsupported symbol");
  });
});

describe("getFearGreedIndex", () => {
  it("returns value and classification from Alternative.me", async () => {
    // getFearGreedIndex uses native fetch, not axios — mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        data: [{ value: "25", value_classification: "Fear" }],
      }),
    }) as unknown as typeof fetch;

    const result = await getFearGreedIndex();
    expect(result.value).toBe(25);
    expect(result.classification).toBe("Fear");
  });

  it("returns neutral defaults on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await getFearGreedIndex();
    expect(result.value).toBe(50);
    expect(result.classification).toBe("Neutral");
  });
});

describe("getNewsSentiment", () => {
  it("returns score 0 and empty items on failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("calculates positive score when most news is positive", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        results: [
          { title: "Bitcoin hits ATH", votes: { positive: 10, negative: 1 }, published_at: "2025-01-01", url: "u1" },
          { title: "BTC gains", votes: { positive: 8, negative: 1 }, published_at: "2025-01-01", url: "u2" },
          { title: "Crypto boom", votes: { positive: 12, negative: 0 }, published_at: "2025-01-01", url: "u3" },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBeGreaterThan(0);
    expect(result.items).toHaveLength(3);
  });

  it("calculates negative score when most news is negative", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        results: [
          { title: "BTC crashes", votes: { positive: 1, negative: 10 }, published_at: "2025-01-01", url: "u1" },
          { title: "Crypto winter", votes: { positive: 0, negative: 15 }, published_at: "2025-01-01", url: "u2" },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await getNewsSentiment("BTCUSDT");
    expect(result.score).toBeLessThan(0);
  });
});
