import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/intelligence", () => ({
  analyzeSymbol: vi.fn(),
}));

vi.mock("../../src/lib/binance", () => ({
  placeOrder: vi.fn(),
}));

vi.mock("../../src/lib/utils", () => ({
  decrypt: vi.fn((v: string) => v + "-decrypted"),
}));

vi.mock("../../src/lib/db", () => ({
  prisma: {
    tradeProposal: {
      count:       vi.fn(),
      updateMany:  vi.fn(),
      findFirst:   vi.fn(),
      create:      vi.fn(),
      findMany:    vi.fn(),
      findUnique:  vi.fn(),
      update:      vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    paperTrade: { create: vi.fn() },
    trade:       { create: vi.fn() },
    marketSnapshot: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
    binanceApiKey: { findFirst: vi.fn() },
  },
}));

import { generateProposals, getPendingProposals, approveProposal, denyProposal } from "../../src/lib/trade-advisor";
import { analyzeSymbol } from "../../src/lib/intelligence";
import { prisma } from "../../src/lib/db";

const mockAnalyze = vi.mocked(analyzeSymbol);
const mockPrisma  = vi.mocked(prisma);

// Minimal IntelligenceReport that passes the MIN_CONFIDENCE=60 threshold
function makeBullishReport(symbol = "BTCUSDT") {
  return {
    symbol,
    price: 50000,
    finalScore: 70,
    confidence: 75,
    recommendation: "BUY" as const,
    side: "BUY" as const,
    entryPrice: 50000,
    stopLoss: 49000,
    takeProfit: 53000,
    riskRewardRatio: 3.0,
    positionSizePct: 2,
    atr: 500,
    trendStrength: 30,
    multiTFAlignment: true,
    factors: [
      { indicator: "RSI_1H",    rawValue: 30, signal: "BUY" as const, score: 75, weight: 1.2, contribution: 90, explanation: "Oversold" },
      { indicator: "MACD_4H",   rawValue: "0.0100", signal: "BUY" as const, score: 90, weight: 1.5, contribution: 135, explanation: "Bullish cross" },
      { indicator: "FEAR_GREED", rawValue: 20, signal: "BUY" as const, score: 70, weight: 1.2, contribution: 84, explanation: "Fear" },
    ],
    summary: "BUY on BTC/USDT — 75% confidence",
    marketCondition: "Moderate trend (ADX 30)",
    fearGreedValue: 20,
    fearGreedLabel: "Fear",
    analysedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  mockPrisma.tradeProposal.count      = vi.fn().mockResolvedValue(0);
  mockPrisma.tradeProposal.updateMany = vi.fn().mockResolvedValue({ count: 0 });
  mockPrisma.tradeProposal.findFirst  = vi.fn().mockResolvedValue(null); // no duplicate
  mockPrisma.tradeProposal.create     = vi.fn().mockResolvedValue({ id: "p1" });
  mockPrisma.tradeProposal.findMany   = vi.fn().mockResolvedValue([]);
  mockPrisma.user.findUnique          = vi.fn().mockResolvedValue({ paperBalance: 10000 });
  mockPrisma.$transaction             = vi.fn().mockResolvedValue([{}, {}, {}]);
  mockPrisma.marketSnapshot.create    = vi.fn().mockResolvedValue({});

  mockAnalyze.mockResolvedValue(null); // default: no signal
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── generateProposals ───────────────────────────────────────────────────────
describe("generateProposals", () => {
  it("returns empty array when user already has 5+ pending proposals", async () => {
    mockPrisma.tradeProposal.count = vi.fn().mockResolvedValue(5);
    const created = await generateProposals("u1");
    expect(created).toHaveLength(0);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("expires old proposals before scanning", async () => {
    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    await genPromise;
    expect(mockPrisma.tradeProposal.updateMany).toHaveBeenCalledOnce();
  });

  it("creates proposal when analyzeSymbol returns high-confidence BUY", async () => {
    mockAnalyze.mockResolvedValueOnce(makeBullishReport("BTCUSDT"));

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    const created = await genPromise;

    expect(created).toHaveLength(1);
    expect(mockPrisma.tradeProposal.create).toHaveBeenCalledOnce();
  });

  it("skips proposals below MIN_CONFIDENCE (60)", async () => {
    mockAnalyze.mockResolvedValueOnce({
      ...makeBullishReport("BTCUSDT"),
      confidence: 45, // below threshold
    });

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    const created = await genPromise;

    expect(created).toHaveLength(0);
  });

  it("skips HOLD recommendations", async () => {
    mockAnalyze.mockResolvedValueOnce({
      ...makeBullishReport("BTCUSDT"),
      recommendation: "HOLD",
      side: null,
    });

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    const created = await genPromise;

    expect(created).toHaveLength(0);
  });

  it("skips when a pending proposal already exists for that symbol", async () => {
    mockAnalyze.mockResolvedValueOnce(makeBullishReport("BTCUSDT"));
    mockPrisma.tradeProposal.findFirst = vi.fn().mockResolvedValue({ id: "existing" });

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    const created = await genPromise;

    expect(created).toHaveLength(0);
  });

  it("caps at 3 new proposals per run", async () => {
    // All 6 symbols return bullish reports
    mockAnalyze.mockResolvedValue(makeBullishReport());
    // No duplicate proposals
    mockPrisma.tradeProposal.findFirst = vi.fn().mockResolvedValue(null);

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    const created = await genPromise;

    expect(created.length).toBeLessThanOrEqual(3);
  });

  it("calculates quantity based on paper balance and positionSizePct", async () => {
    const report = makeBullishReport("BTCUSDT");
    report.positionSizePct = 2; // 2% of $10000 = $200
    report.entryPrice = 50000;
    mockAnalyze.mockResolvedValueOnce(report);

    const genPromise = generateProposals("u1");
    await vi.runAllTimersAsync();
    await genPromise;

    const createCall = (mockPrisma.tradeProposal.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const expectedQty = (10000 * 0.02) / 50000; // 0.004
    expect(createCall.data.quantity).toBeCloseTo(expectedQty, 6);
  });
});

// ─── getPendingProposals ─────────────────────────────────────────────────────
describe("getPendingProposals", () => {
  it("returns pending proposals ordered by confidence desc", async () => {
    const proposals = [
      { id: "p1", confidence: 75, symbol: "BTCUSDT", status: "PENDING" },
      { id: "p2", confidence: 85, symbol: "ETHUSDT", status: "PENDING" },
    ];
    mockPrisma.tradeProposal.findMany = vi.fn().mockResolvedValue(proposals);

    const result = await getPendingProposals("u1");
    expect(result).toHaveLength(2);
    expect(mockPrisma.tradeProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
        orderBy: { confidence: "desc" },
      })
    );
  });
});

// ─── approveProposal ─────────────────────────────────────────────────────────
describe("approveProposal", () => {
  const makeProposal = (overrides = {}) => ({
    id: "p1",
    userId: "u1",
    symbol: "BTCUSDT",
    side: "BUY",
    quantity: 0.004,
    entryPrice: 50000,
    stopLoss: 49000,
    takeProfit: 53000,
    confidence: 75,
    mode: "PAPER",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 3600e3), // 1h from now
    ...overrides,
  });

  it("throws when proposal not found", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(null);
    await expect(approveProposal("nonexistent", "u1")).rejects.toThrow("not found");
  });

  it("throws when proposal belongs to different user", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(makeProposal({ userId: "other" }));
    await expect(approveProposal("p1", "u1")).rejects.toThrow("not found");
  });

  it("throws when proposal is already executed", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(makeProposal({ status: "EXECUTED" }));
    await expect(approveProposal("p1", "u1")).rejects.toThrow("not found");
  });

  it("throws when proposal has expired", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(
      makeProposal({ expiresAt: new Date(Date.now() - 1000) }) // expired 1s ago
    );
    await expect(approveProposal("p1", "u1")).rejects.toThrow("expired");
  });

  it("executes PAPER trade atomically", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(makeProposal());
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 10000 });

    await approveProposal("p1", "u1");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("throws 'Insufficient paper balance' when cost > balance on BUY", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(
      makeProposal({ quantity: 1, entryPrice: 50000 }) // cost = $50000
    );
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ paperBalance: 100 });

    await expect(approveProposal("p1", "u1")).rejects.toThrow("Insufficient paper balance");
  });

  it("LIVE mode throws when no API key configured", async () => {
    mockPrisma.tradeProposal.findUnique = vi.fn().mockResolvedValue(makeProposal({ mode: "LIVE" }));
    mockPrisma.binanceApiKey = { findFirst: vi.fn().mockResolvedValue(null) } as typeof mockPrisma.binanceApiKey;

    await expect(approveProposal("p1", "u1")).rejects.toThrow("No active Binance API key");
  });
});

// ─── denyProposal ────────────────────────────────────────────────────────────
describe("denyProposal", () => {
  it("updates proposal status to DENIED", async () => {
    mockPrisma.tradeProposal.update = vi.fn().mockResolvedValue({ id: "p1", status: "DENIED" });
    await denyProposal("p1", "u1");
    expect(mockPrisma.tradeProposal.update).toHaveBeenCalledWith({
      where: { id: "p1", userId: "u1" },
      data:  { status: "DENIED" },
    });
  });
});
