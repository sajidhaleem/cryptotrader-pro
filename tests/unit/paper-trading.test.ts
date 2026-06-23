import { describe, it, expect, vi, beforeEach } from "vitest";

// paper-trading.ts uses getPriceCG from ./market-data (Binance is geo-blocked)
vi.mock("../../src/lib/market-data", () => ({
  getPriceCG: vi.fn(),
}));

vi.mock("../../src/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    paperTrade: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { executePaperTrade, getPaperPortfolio } from "../../src/lib/paper-trading";
import { getPriceCG } from "../../src/lib/market-data";
import { prisma } from "../../src/lib/db";

const mockGetPrice = vi.mocked(getPriceCG);
const mockPrisma   = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrice.mockResolvedValue(50000);
  mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ id: "u1", paperBalance: 10000 });
  mockPrisma.$transaction    = vi.fn().mockResolvedValue([{}, {}]);
  mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([]);
});

describe("executePaperTrade — BUY", () => {
  it("returns success for a valid buy", async () => {
    const result = await executePaperTrade("u1", "BTCUSDT", "BUY", 0.1);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Paper BUY");
    expect(result.trade?.symbol).toBe("BTCUSDT");
    expect(result.trade?.side).toBe("BUY");
    expect(result.trade?.quantity).toBe(0.1);
    expect(result.trade?.price).toBe(50000);
  });

  it("deducts correct cost (total + 0.1% fee) from balance", async () => {
    const price = 50000;
    const quantity = 0.1;
    const total = price * quantity;           // 5000
    const fee   = total * 0.001;              // 5
    const expectedBalance = 10000 - total - fee; // 4995

    const result = await executePaperTrade("u1", "BTCUSDT", "BUY", quantity);
    expect(result.newBalance).toBeCloseTo(expectedBalance, 2);
  });

  it("fails when user not found", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
    const result = await executePaperTrade("missing", "BTCUSDT", "BUY", 0.1);
    expect(result.success).toBe(false);
    expect(result.message).toContain("User not found");
  });

  it("fails when balance is insufficient", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 100 }); // only $100
    const result = await executePaperTrade("u1", "BTCUSDT", "BUY", 0.1); // needs ~$5005
    expect(result.success).toBe(false);
    expect(result.message).toContain("Insufficient");
  });

  it("calls $transaction to atomically create trade + update balance", async () => {
    await executePaperTrade("u1", "BTCUSDT", "BUY", 0.01);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe("executePaperTrade — SELL", () => {
  it("returns success for a valid sell", async () => {
    // User has prior buy at same price → PnL = 0
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([
      { price: 50000, quantity: 0.1, side: "BUY" },
    ]);
    const result = await executePaperTrade("u1", "BTCUSDT", "SELL", 0.1);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Paper SELL");
    expect(result.trade?.side).toBe("SELL");
  });

  it("adds revenue to balance on sell", async () => {
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([]);
    const price    = 50000;
    const quantity = 0.1;
    const total    = price * quantity;      // 5000
    const fee      = total * 0.001;         // 5
    const revenue  = total - fee;           // 4995
    const expectedBalance = 10000 + revenue; // 14995

    const result = await executePaperTrade("u1", "BTCUSDT", "SELL", quantity);
    expect(result.newBalance).toBeCloseTo(expectedBalance, 2);
  });

  it("calculates PnL correctly when sell price > avg buy price", async () => {
    mockGetPrice.mockResolvedValue(60000); // price went up from 50000
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([
      { price: 50000, quantity: 0.1, side: "BUY" },
    ]);

    const result = await executePaperTrade("u1", "BTCUSDT", "SELL", 0.1);
    expect(result.success).toBe(true);
    // PnL = (60000 - 50000) * 0.1 = 1000
    // Revenue = 60000 * 0.1 * (1 - 0.001) = 5994
  });

  it("fails when user not found on sell", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
    const result = await executePaperTrade("u1", "BTCUSDT", "SELL", 0.1);
    expect(result.success).toBe(false);
  });
});

describe("getPaperPortfolio", () => {
  it("returns cash balance and holdings", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 8500 });
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([
      { symbol: "BTCUSDT", side: "BUY", quantity: 0.1, price: 50000, total: 5000, pnl: 0, createdAt: new Date() },
    ]);

    const portfolio = await getPaperPortfolio("u1");
    expect(portfolio.cashBalance).toBe(8500);
    expect(portfolio.holdings["BTCUSDT"]).toBeDefined();
    expect(portfolio.holdings["BTCUSDT"].quantity).toBeCloseTo(0.1, 6);
    expect(portfolio.holdings["BTCUSDT"].avgPrice).toBeCloseTo(50000, 0);
  });

  it("removes holding after selling full quantity", async () => {
    const buyDate  = new Date(Date.now() - 1000);
    const sellDate = new Date(Date.now());
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([
      { symbol: "BTCUSDT", side: "SELL", quantity: 0.1, price: 52000, total: 5200, pnl: 200, createdAt: sellDate },
      { symbol: "BTCUSDT", side: "BUY",  quantity: 0.1, price: 50000, total: 5000, pnl: 0,   createdAt: buyDate  },
    ]);

    const portfolio = await getPaperPortfolio("u1");
    expect(portfolio.holdings["BTCUSDT"]).toBeUndefined();
  });

  it("computes average buy price correctly for multiple buys", async () => {
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([
      { symbol: "ETHUSDT", side: "BUY", quantity: 1, price: 3000, total: 3000, pnl: 0, createdAt: new Date(1) },
      { symbol: "ETHUSDT", side: "BUY", quantity: 1, price: 4000, total: 4000, pnl: 0, createdAt: new Date(2) },
    ]);

    const portfolio = await getPaperPortfolio("u1");
    expect(portfolio.holdings["ETHUSDT"].avgPrice).toBeCloseTo(3500, 0);
    expect(portfolio.holdings["ETHUSDT"].quantity).toBeCloseTo(2, 6);
  });

  it("returns $10000 default balance when user is null", async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue([]);
    const portfolio = await getPaperPortfolio("ghost");
    expect(portfolio.cashBalance).toBe(10000);
  });

  it("limits trade history to 20 entries", async () => {
    const trades = Array.from({ length: 30 }, (_, i) => ({
      symbol: "BTCUSDT", side: "BUY", quantity: 0.01,
      price: 50000 + i, total: 500, pnl: 0, createdAt: new Date(i),
    }));
    mockPrisma.paperTrade.findMany = vi.fn().mockResolvedValue(trades);

    const portfolio = await getPaperPortfolio("u1");
    expect(portfolio.trades).toHaveLength(20);
  });
});
