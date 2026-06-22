// Bot execution engine — DCA, RSI, MACD, Grid strategies
// All bots execute paper trades by default; set config.mode = "LIVE" for real orders
import { RSI, MACD } from "technicalindicators";
import { prisma } from "./db";
import { getKlines, getPrice, placeOrder } from "./binance";
import { decrypt } from "./utils";

// Binance enforces $10 minimum notional per order — we use $15 as safety buffer.
// Orders below this are rejected with MIN_NOTIONAL error, wasting an API call.
const MIN_ORDER_USDT = 15;

// Round quantity to Binance-acceptable precision.
// Most altcoins: 6 decimal places. High-price assets (BTC): 5 suffices.
// Binance rejects quantities with more decimal places than the symbol's LOT_SIZE stepSize.
function safeQuantity(quantity: number, price: number): number {
  // High-value assets (>$1k/coin): use 5 decimal places; others: 6
  const decimals = price > 1000 ? 5 : 6;
  return parseFloat(quantity.toFixed(decimals));
}

interface DCAConfig   { amount: number; interval: string; lastExecuted?: string | null; mode?: string; }
interface RSIConfig   { amount: number; interval: string; rsiLow: number; rsiHigh: number; lastExecuted?: string | null; mode?: string; }
interface MACDConfig  { amount: number; interval: string; lastExecuted?: string | null; lastHistogram?: number | null; mode?: string; }
interface GridConfig  { amount: number; gridLow: number; gridHigh: number; gridLevels: number; lastExecuted?: string | null; mode?: string; }

function shouldExecute(lastExecuted: string | null | undefined, intervalStr: string): boolean {
  if (!lastExecuted) return true;
  const map: Record<string, number> = {
    "30m": 30 * 60e3, "1h": 60 * 60e3, "4h": 4 * 3600e3,
    "12h": 12 * 3600e3, "24h": 24 * 3600e3, "1d": 24 * 3600e3,
  };
  return Date.now() - new Date(lastExecuted).getTime() >= (map[intervalStr] ?? 4 * 3600e3);
}

async function paperBuy(userId: string, symbol: string, amount: number): Promise<{ success: boolean; message: string }> {
  if (amount < MIN_ORDER_USDT) return { success: false, message: `Order too small ($${amount} < $${MIN_ORDER_USDT} minimum)` };

  const price    = await getPrice(symbol);
  const quantity = safeQuantity(amount / price, price);
  const total    = amount * 1.001; // include 0.1% fee

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { paperBalance: true } });
  if (!user || user.paperBalance < total) {
    return { success: false, message: `Insufficient paper balance ($${(user?.paperBalance ?? 0).toFixed(2)})` };
  }

  await prisma.$transaction([
    prisma.paperTrade.create({
      data: { userId, symbol, side: "BUY", quantity, price, total: amount, pnl: 0, status: "FILLED" },
    }),
    prisma.user.update({ where: { id: userId }, data: { paperBalance: { decrement: total } } }),
  ]);

  return { success: true, message: `Paper BUY ${quantity.toFixed(6)} ${symbol} @ $${price.toFixed(2)}` };
}

async function liveBuy(userId: string, symbol: string, amount: number): Promise<{ success: boolean; message: string }> {
  if (amount < MIN_ORDER_USDT) return { success: false, message: `Order too small ($${amount} < $${MIN_ORDER_USDT} minimum)` };

  const encKey = process.env.ENCRYPTION_KEY ?? "";
  const keyRecord = await prisma.binanceApiKey.findFirst({ where: { userId, isActive: true } });
  if (!keyRecord) return { success: false, message: "No active Binance API key" };

  try {
    const apiKey    = decrypt(keyRecord.apiKey, encKey);
    const secretKey = decrypt(keyRecord.secretKey, encKey);
    const price     = await getPrice(symbol);
    const quantity  = safeQuantity(amount / price, price);

    await placeOrder(apiKey, secretKey, symbol, "BUY", quantity, keyRecord.isTestnet);
    await prisma.trade.create({
      data: { userId, symbol, side: "BUY", quantity, price, total: amount, fee: amount * 0.001 },
    });
    return { success: true, message: `Live BUY ${quantity.toFixed(6)} ${symbol} @ $${price.toFixed(2)}` };
  } catch (err: unknown) {
    return { success: false, message: `Order failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function doBuy(userId: string, symbol: string, amount: number, mode?: string) {
  return mode === "LIVE" ? liveBuy(userId, symbol, amount) : paperBuy(userId, symbol, amount);
}

// ─── Strategy Executors ───────────────────────────────────────────────────────

export async function executeDCA(botId: string, userId: string, symbol: string, config: DCAConfig): Promise<string> {
  if (!shouldExecute(config.lastExecuted, config.interval)) return "DCA not due yet";

  const result = await doBuy(userId, symbol, config.amount, config.mode);
  if (result.success) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    await prisma.bot.update({
      where: { id: botId },
      data: {
        config: { ...(bot?.config as object ?? {}), ...config, lastExecuted: new Date().toISOString() },
        totalTrades: { increment: 1 },
      },
    });
  }
  return result.message;
}

export async function executeRSIBot(botId: string, userId: string, symbol: string, config: RSIConfig): Promise<string> {
  if (!shouldExecute(config.lastExecuted, config.interval ?? "1h")) return "RSI bot not due";

  const tfMap: Record<string, string> = { "30m": "30m", "1h": "1h", "4h": "4h", "24h": "1d", "1d": "1d" };
  const klines = await getKlines(symbol, tfMap[config.interval ?? "1h"] ?? "1h", 50);
  if (klines.length < 15) return "RSI: insufficient data";

  const rsiArr = RSI.calculate({ period: 14, values: klines.map(k => k.close) });
  const rsi    = rsiArr[rsiArr.length - 1];
  if (rsi == null) return "RSI: calculation error";

  if (rsi < config.rsiLow) {
    const result = await doBuy(userId, symbol, config.amount, config.mode);
    if (result.success) {
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      await prisma.bot.update({
        where: { id: botId },
        data: {
          config: { ...(bot?.config as object ?? {}), ...config, lastExecuted: new Date().toISOString() },
          totalTrades: { increment: 1 },
        },
      });
    }
    return `RSI ${rsi.toFixed(1)} < ${config.rsiLow} → ${result.message}`;
  }

  return `RSI ${rsi.toFixed(1)} — no trigger (buy below ${config.rsiLow})`;
}

export async function executeMACDBot(botId: string, userId: string, symbol: string, config: MACDConfig): Promise<string> {
  if (!shouldExecute(config.lastExecuted, config.interval ?? "4h")) return "MACD bot not due";

  const tfMap: Record<string, string> = { "1h": "1h", "4h": "4h", "24h": "1d", "1d": "1d" };
  const klines = await getKlines(symbol, tfMap[config.interval ?? "4h"] ?? "4h", 60);
  if (klines.length < 35) return "MACD: insufficient data";

  const macdArr = MACD.calculate({
    values: klines.map(k => k.close), fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });

  const last = macdArr[macdArr.length - 1];
  const prev = macdArr[macdArr.length - 2];
  if (!last || !prev) return "MACD: insufficient history";

  const hist     = last.histogram ?? 0;
  const prevHist = prev.histogram ?? (config.lastHistogram ?? 0);

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  const baseConfig = bot?.config as object ?? {};

  if (prevHist <= 0 && hist > 0) {
    const result = await doBuy(userId, symbol, config.amount, config.mode);
    if (result.success) {
      await prisma.bot.update({
        where: { id: botId },
        data: {
          config: { ...baseConfig, ...config, lastExecuted: new Date().toISOString(), lastHistogram: hist },
          totalTrades: { increment: 1 },
        },
      });
    }
    return `MACD bullish cross → ${result.message}`;
  }

  // Always persist latest histogram for next crossover detection
  await prisma.bot.update({
    where: { id: botId },
    data: { config: { ...baseConfig, ...config, lastHistogram: hist } },
  });

  return `MACD hist ${hist.toFixed(4)} — no crossover yet`;
}

export async function executeGridBot(botId: string, userId: string, symbol: string, config: GridConfig): Promise<string> {
  if (!config.gridLow || !config.gridHigh || config.gridLow >= config.gridHigh) {
    return "Grid bot: invalid price range";
  }

  const price = await getPrice(symbol);
  if (price < config.gridLow || price > config.gridHigh) {
    return `Grid bot: price $${price.toFixed(2)} outside range ($${config.gridLow}–$${config.gridHigh})`;
  }

  const step  = (config.gridHigh - config.gridLow) / (config.gridLevels ?? 10);
  const level = Math.floor((price - config.gridLow) / step);
  const gridLine = config.gridLow + level * step;

  // Only execute if within 0.5% of a grid line
  const distPct = Math.abs(price - gridLine) / gridLine * 100;
  if (distPct > 0.5) {
    return `Grid: price $${price.toFixed(2)} not near grid level $${gridLine.toFixed(2)} (${distPct.toFixed(1)}% away)`;
  }

  // Avoid duplicate buys at same level — check if we already bought here recently
  if (config.lastExecuted) {
    const lastBot = await prisma.bot.findUnique({ where: { id: botId } });
    const lastCfg = lastBot?.config as Record<string, unknown> ?? {};
    if (lastCfg.lastGridLevel === level && shouldExecute(config.lastExecuted, "1h") === false) {
      return `Grid: already bought at level ${level} recently`;
    }
  }

  const result = await doBuy(userId, symbol, config.amount, config.mode);
  if (result.success) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    await prisma.bot.update({
      where: { id: botId },
      data: {
        config: { ...(bot?.config as object ?? {}), ...config, lastExecuted: new Date().toISOString(), lastGridLevel: level },
        totalTrades: { increment: 1 },
      },
    });
  }
  return `Grid level ${level} ($${gridLine.toFixed(2)}): ${result.message}`;
}

// ─── Main runner called by scheduler ─────────────────────────────────────────

export async function runAllBots(userId: string): Promise<Array<{ botId: string; name: string; result: string }>> {
  const bots = await prisma.bot.findMany({ where: { userId, status: "RUNNING" } });
  const results = [];

  for (const bot of bots) {
    const cfg = bot.config as Record<string, unknown>;
    let result = "Unknown strategy";
    try {
      switch (bot.strategy) {
        case "DCA":  result = await executeDCA     (bot.id, userId, bot.symbol, cfg as unknown as DCAConfig);  break;
        case "RSI":  result = await executeRSIBot  (bot.id, userId, bot.symbol, cfg as unknown as RSIConfig);  break;
        case "MACD": result = await executeMACDBot (bot.id, userId, bot.symbol, cfg as unknown as MACDConfig); break;
        case "GRID": result = await executeGridBot (bot.id, userId, bot.symbol, cfg as unknown as GridConfig); break;
      }
    } catch (err) {
      result = `Error: ${err instanceof Error ? err.message : "unknown"}`;
      console.warn(`[Bots] ${bot.name} (${bot.id}) failed:`, err);
    }
    results.push({ botId: bot.id, name: bot.name, result });
  }

  return results;
}
