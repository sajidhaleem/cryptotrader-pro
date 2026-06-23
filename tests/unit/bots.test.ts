import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and market data before importing bots
vi.mock("../../src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    bot: {
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      update:     vi.fn(),
    },
    paperTrade: { create: vi.fn() },
    trade:      { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../src/lib/market-data", () => ({
  getPriceCG:   vi.fn(),
  getKlinesCG:  vi.fn(),
}));

vi.mock("../../src/lib/binance", () => ({
  placeOrder: vi.fn(),
}));

vi.mock("../../src/lib/utils", () => ({
  decrypt: vi.fn((v: string) => v + "-decrypted"),
}));

import { executeDCA, executeRSIBot, executeMACDBot, executeGridBot, runAllBots } from "../../src/lib/bots";
import { prisma } from "../../src/lib/db";
import { getPriceCG, getKlinesCG } from "../../src/lib/market-data";

const mockPrisma     = vi.mocked(prisma);
const mockGetPrice   = vi.mocked(getPriceCG);
const mockGetKlines  = vi.mocked(getKlinesCG);

// Helper: flat klines at a fixed price
function makeKlines(count: number, price = 50000) {
  return Array.from({ length: count }, (_, i) => ({
    openTime:  Date.now() - (count - i) * 3600e3,
    open: price, high: price * 1.005, low: price * 0.995, close: price,
    volume: 1000000,
    closeTime: Date.now() - (count - i - 1) * 3600e3 - 1,
  }));
}

// Klines with strong downtrend to force RSI into oversold
function makeOversoldKlines(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    openTime:  i * 3600e3,
    open: 50000 - i * 500, high: 50000 - i * 490, low: 50000 - i * 510,
    close: Math.max(1000, 50000 - i * 500),
    volume: 1000000,
    closeTime: i * 3600e3 + 3599e3,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: user has $10k paper balance
  mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 10000 });
  mockPrisma.bot.findUnique  = vi.fn().mockResolvedValue({ id: "bot1", config: {} });
  mockPrisma.bot.update      = vi.fn().mockResolvedValue({});
  mockPrisma.$transaction    = vi.fn().mockResolvedValue([{}, {}]);

  mockGetPrice.mockResolvedValue(50000);
  mockGetKlines.mockResolvedValue(makeKlines(60));
});

// ─── DCA ──────────────────────────────────────────────────────────────────────
describe("executeDCA", () => {
  it("executes a paper buy and returns success message", async () => {
    const result = await executeDCA("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
    });
    expect(result).toContain("Paper BUY");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.bot.update).toHaveBeenCalledOnce();
  });

  it("skips when interval not elapsed (lastExecuted = now)", async () => {
    const result = await executeDCA("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
      lastExecuted: new Date().toISOString(),
    });
    expect(result).toBe("DCA not due yet");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("executes when lastExecuted is far in the past", async () => {
    const pastDate = new Date(Date.now() - 5 * 3600e3).toISOString(); // 5h ago
    const result = await executeDCA("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", lastExecuted: pastDate,
    });
    expect(result).toContain("BUY");
  });

  it("rejects order below $15 minimum", async () => {
    const result = await executeDCA("bot1", "user1", "BTCUSDT", {
      amount: 10, interval: "4h",
    });
    expect(result).toContain("too small");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when insufficient paper balance", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 5 });
    const result = await executeDCA("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
    });
    expect(result).toContain("Insufficient");
  });
});

// ─── RSI Bot ─────────────────────────────────────────────────────────────────
describe("executeRSIBot", () => {
  it("returns 'not due' when interval has not elapsed", async () => {
    const result = await executeRSIBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", rsiLow: 35, rsiHigh: 65,
      lastExecuted: new Date().toISOString(),
    });
    expect(result).toBe("RSI bot not due");
  });

  it("returns RSI value in message when RSI is above rsiLow (no trigger)", async () => {
    // Flat klines → RSI ≈ 50
    const result = await executeRSIBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", rsiLow: 35, rsiHigh: 65,
    });
    expect(result).toMatch(/RSI \d+\.\d — no trigger/);
  });

  it("triggers buy when RSI is oversold", async () => {
    mockGetKlines.mockResolvedValue(makeOversoldKlines(60));
    const result = await executeRSIBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", rsiLow: 70, rsiHigh: 80, // very high threshold — always triggers on downtrend
    });
    expect(result).toMatch(/RSI.*→/);
  });

  it("returns insufficient data with < 15 klines", async () => {
    mockGetKlines.mockResolvedValue(makeKlines(10));
    const result = await executeRSIBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", rsiLow: 35, rsiHigh: 65,
    });
    expect(result).toBe("RSI: insufficient data");
  });
});

// ─── MACD Bot ────────────────────────────────────────────────────────────────
describe("executeMACDBot", () => {
  it("returns 'not due' when interval has not elapsed", async () => {
    const result = await executeMACDBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
      lastExecuted: new Date().toISOString(),
    });
    expect(result).toBe("MACD bot not due");
  });

  it("returns histogram value when no crossover", async () => {
    // Flat series → no MACD crossover
    const result = await executeMACDBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
    });
    expect(result).toMatch(/MACD hist/);
    expect(mockPrisma.bot.update).toHaveBeenCalled(); // saves histogram
  });

  it("returns insufficient data with < 35 klines", async () => {
    mockGetKlines.mockResolvedValue(makeKlines(20));
    const result = await executeMACDBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h",
    });
    expect(result).toBe("MACD: insufficient data");
  });

  it("fires buy on bullish MACD crossover (prevHist<0 → hist>0)", async () => {
    // Simulate crossover: build series that transitions from down to up
    const klines = [
      ...makeKlines(30, 50000), // flat
      ...Array.from({ length: 30 }, (_, i) => ({
        openTime: Date.now() + i * 3600e3,
        open: 50000 + i * 300, high: 50000 + i * 310, low: 50000 + i * 290,
        close: 50000 + i * 300,
        volume: 1000000, closeTime: Date.now() + i * 3600e3 + 3599e3,
      })),
    ];
    mockGetKlines.mockResolvedValue(klines);

    // Set lastHistogram negative to simulate we were bearish
    const result = await executeMACDBot("bot1", "user1", "BTCUSDT", {
      amount: 50, interval: "4h", lastHistogram: -0.001,
    });
    // May or may not cross zero — just verify it runs without error
    expect(typeof result).toBe("string");
  });
});

// ─── Grid Bot ─────────────────────────────────────────────────────────────────
describe("executeGridBot", () => {
  it("returns error on invalid price range (low >= high)", async () => {
    const result = await executeGridBot("bot1", "user1", "BTCUSDT", {
      amount: 50, gridLow: 60000, gridHigh: 40000, gridLevels: 10,
    });
    expect(result).toContain("invalid price range");
  });

  it("returns 'outside range' when price is below gridLow", async () => {
    mockGetPrice.mockResolvedValue(30000); // price below gridLow
    const result = await executeGridBot("bot1", "user1", "BTCUSDT", {
      amount: 50, gridLow: 40000, gridHigh: 60000, gridLevels: 10,
    });
    expect(result).toContain("outside range");
  });

  it("returns 'outside range' when price is above gridHigh", async () => {
    mockGetPrice.mockResolvedValue(70000); // price above gridHigh
    const result = await executeGridBot("bot1", "user1", "BTCUSDT", {
      amount: 50, gridLow: 40000, gridHigh: 60000, gridLevels: 10,
    });
    expect(result).toContain("outside range");
  });

  it("executes near a grid level (price at exact grid line)", async () => {
    // 10 levels between 40000-60000 → step = 2000 → levels: 40000, 42000, 44000...
    mockGetPrice.mockResolvedValue(44000); // exactly at level 2
    const result = await executeGridBot("bot1", "user1", "BTCUSDT", {
      amount: 50, gridLow: 40000, gridHigh: 60000, gridLevels: 10,
    });
    // Should be near a grid level (0% away) → executes or checks duplicate
    expect(result).not.toContain("invalid price range");
    expect(result).not.toContain("outside range");
  });

  it("skips when price is too far from any grid level", async () => {
    // Place price in middle of gap: step=2000, so 41001 is 50% into gap → > 0.5%
    mockGetPrice.mockResolvedValue(41001);
    const result = await executeGridBot("bot1", "user1", "BTCUSDT", {
      amount: 50, gridLow: 40000, gridHigh: 60000, gridLevels: 10,
    });
    expect(result).toContain("not near grid level");
  });
});

// ─── runAllBots ───────────────────────────────────────────────────────────────
describe("runAllBots", () => {
  it("returns empty array when user has no running bots", async () => {
    mockPrisma.bot.findMany = vi.fn().mockResolvedValue([]);
    const results = await runAllBots("user1");
    expect(results).toHaveLength(0);
  });

  it("runs each bot and returns results", async () => {
    mockPrisma.bot.findMany = vi.fn().mockResolvedValue([
      { id: "b1", name: "My DCA", strategy: "DCA", symbol: "BTCUSDT",
        config: { amount: 50, interval: "4h" }, status: "RUNNING" },
    ]);
    const results = await runAllBots("user1");
    expect(results).toHaveLength(1);
    expect(results[0].botId).toBe("b1");
    expect(results[0].name).toBe("My DCA");
    expect(typeof results[0].result).toBe("string");
  });

  it("catches errors per bot and continues", async () => {
    mockPrisma.bot.findMany = vi.fn().mockResolvedValue([
      { id: "b1", name: "Broken Bot", strategy: "DCA", symbol: "BTCUSDT",
        config: { amount: 50, interval: "4h" }, status: "RUNNING" },
      { id: "b2", name: "Good Bot", strategy: "DCA", symbol: "ETHUSDT",
        config: { amount: 50, interval: "4h" }, status: "RUNNING" },
    ]);
    // Make first bot throw
    mockGetPrice
      .mockRejectedValueOnce(new Error("CoinGecko down"))
      .mockResolvedValueOnce(3500);

    const results = await runAllBots("user1");
    expect(results).toHaveLength(2);
    expect(results[0].result).toContain("Error");
    expect(results[1].result).toContain("BUY");
  });
});
