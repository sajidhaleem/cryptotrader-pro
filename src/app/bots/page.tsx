"use client";

import { useEffect, useState } from "react";
import type { BotRecommendation } from "@/lib/bot-advisor";
import { NIM_MODELS, DEFAULT_NIM_MODEL, type NimModelId } from "@/lib/nvidia-nim";
import { KIMI_MODELS, DEFAULT_KIMI_MODEL, type KimiModelId } from "@/lib/kimi";
import { COMMODITY_ASSETS, FOREX_ASSETS } from "@/lib/market-signals-types";

type AIProvider = "claude" | "nim" | "kimi";

// ── Asset lists ───────────────────────────────────────────────────────────────
const CRYPTO_PAIRS = [
  { symbol: "BTCUSDT",  label: "Bitcoin (BTC)"    },
  { symbol: "ETHUSDT",  label: "Ethereum (ETH)"   },
  { symbol: "BNBUSDT",  label: "BNB"               },
  { symbol: "SOLUSDT",  label: "Solana (SOL)"      },
  { symbol: "ADAUSDT",  label: "Cardano (ADA)"     },
  { symbol: "DOGEUSDT", label: "Dogecoin (DOGE)"   },
  { symbol: "XRPUSDT",  label: "XRP"               },
  { symbol: "AVAXUSDT", label: "Avalanche (AVAX)"  },
  { symbol: "DOTUSDT",  label: "Polkadot (DOT)"    },
  { symbol: "LINKUSDT", label: "Chainlink (LINK)"  },
  { symbol: "LTCUSDT",  label: "Litecoin (LTC)"    },
  { symbol: "MATICUSDT",label: "Polygon (MATIC)"   },
];

const COMMODITY_PAIRS = COMMODITY_ASSETS.map(a => ({ symbol: a.symbol, label: `${a.label} (${a.short})` }));
const FOREX_PAIRS     = FOREX_ASSETS.map(a => ({ symbol: a.symbol, label: a.label }));

type AssetCategory = "crypto" | "commodity" | "forex";

// ── Existing bots ─────────────────────────────────────────────────────────────
interface Bot {
  id: string;
  name: string;
  strategy: string;
  symbol: string;
  status: "RUNNING" | "STOPPED" | "PAUSED";
  totalPnl: number;
  totalTrades: number;
  config: Record<string, unknown>;
  createdAt: string;
}

const STRATEGIES = [
  { id: "DCA",  label: "DCA",     desc: "Buy at fixed intervals regardless of price — safest accumulation strategy", icon: "📅" },
  { id: "GRID", label: "Grid",    desc: "Buy at multiple price levels within a defined range — profits from oscillation", icon: "🔲" },
  { id: "RSI",  label: "RSI Bot", desc: "Buy when RSI < threshold (oversold), exit when overbought",                  icon: "📊" },
  { id: "MACD", label: "MACD",    desc: "Trades on MACD histogram crossover — best in trending markets",              icon: "📈" },
];

const STATUS_COLORS = {
  RUNNING: "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30",
  STOPPED: "text-[#64748b] bg-[#1a1f2e] border-[#1e2130]",
  PAUSED:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

const PHASE_COLORS: Record<string, string> = {
  RANGING:       "text-blue-400 bg-blue-400/10 border-blue-400/30",
  TRENDING_UP:   "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30",
  TRENDING_DOWN: "text-red-400 bg-red-400/10 border-red-400/30",
  VOLATILE:      "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  ACCUMULATION:  "text-purple-400 bg-purple-400/10 border-purple-400/30",
};

const ACTION_COLORS: Record<string, string> = {
  BUY:  "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30",
  SELL: "text-red-400 bg-red-400/10 border-red-400/30",
  HOLD: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

const DEFAULT_FORM = {
  name: "", strategy: "DCA", symbol: "BTCUSDT",
  interval: "4h", amount: "50",
  rsiLow: "32", rsiHigh: "68",
  gridLow: "", gridHigh: "", gridLevels: "8",
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const cfg =
    sentiment === "BULLISH" ? { color: "#00ff88", bg: "#00ff8810", label: "🟢 Bullish News" }
    : sentiment === "BEARISH" ? { color: "#ef4444", bg: "#ef444410", label: "🔴 Bearish News" }
    : { color: "#f59e0b", bg: "#f59e0b10", label: "🟡 Neutral News" };
  return (
    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function formatLevel(price: number, category: AssetCategory) {
  if (category === "forex") return price.toFixed(4);
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function BotCard({ bot, onToggle, onDelete, onRefresh }: {
  bot: Bot;
  onToggle: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing]         = useState(false);
  const [saving,  setSaving]          = useState(false);
  const [livePrice, setLivePrice]     = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const cfg = bot.config as Record<string, unknown>;

  const [editForm, setEditForm] = useState({
    gridLow:    String(cfg.gridLow    ?? ""),
    gridHigh:   String(cfg.gridHigh   ?? ""),
    gridLevels: String(cfg.gridLevels ?? "8"),
    amount:     String(cfg.amount     ?? "50"),
    rsiLow:     String(cfg.rsiLow     ?? "32"),
    rsiHigh:    String(cfg.rsiHigh    ?? "68"),
    interval:   String(cfg.interval   ?? "4h"),
  });

  const isGrid = bot.strategy === "GRID";
  const isRSI  = bot.strategy === "RSI";
  const hasGridError = isGrid && (!cfg.gridLow || !cfg.gridHigh || Number(cfg.gridLow) >= Number(cfg.gridHigh));

  async function fetchLivePrice() {
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/signals?symbol=${bot.symbol}&interval=4h`);
      const data = await res.json() as { price?: number };
      if (data?.price) {
        setLivePrice(data.price);
        const p = data.price;
        const low  = Math.round(p * 0.88 / 500) * 500;
        const high = Math.round(p * 1.12 / 500) * 500;
        setEditForm(f => ({ ...f, gridLow: String(low), gridHigh: String(high) }));
      }
    } catch { /* ignore */ } finally {
      setFetchingPrice(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    const newConfig: Record<string, unknown> = { amount: parseFloat(editForm.amount) };
    if (isGrid) {
      newConfig.gridLow    = parseFloat(editForm.gridLow);
      newConfig.gridHigh   = parseFloat(editForm.gridHigh);
      newConfig.gridLevels = parseInt(editForm.gridLevels);
    }
    if (isRSI || bot.strategy === "DCA" || bot.strategy === "MACD") {
      newConfig.interval = editForm.interval;
    }
    if (isRSI) {
      newConfig.rsiLow  = parseFloat(editForm.rsiLow);
      newConfig.rsiHigh = parseFloat(editForm.rsiHigh);
    }
    await fetch("/api/bots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bot.id, config: newConfig }),
    });
    setEditing(false);
    setSaving(false);
    await onRefresh();
  }

  return (
    <div className={`bg-[#0f1117] border rounded-2xl overflow-hidden transition-colors ${hasGridError ? "border-red-500/40" : "border-[#1e2130]"}`}>
      {/* Header row */}
      <div className="p-5 flex items-center gap-4">
        <div className="text-2xl">{STRATEGIES.find(s => s.id === bot.strategy)?.icon ?? "🤖"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-white">{bot.name}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[bot.status]}`}>
              {bot.status}
            </span>
            {hasGridError && (
              <span className="px-2 py-0.5 text-xs rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
                ❌ Invalid grid range
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748b]">
            {bot.strategy} · {bot.symbol} · {bot.totalTrades} trades
            {isGrid && !!cfg.gridLow && !!cfg.gridHigh && (
              <span className="ml-2 text-[#475569]">(grid: ${Number(cfg.gridLow as number).toLocaleString()}–${Number(cfg.gridHigh as number).toLocaleString()})</span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`font-semibold text-sm ${bot.totalPnl >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
            {bot.totalPnl >= 0 ? "+" : ""}${bot.totalPnl.toFixed(2)}
          </p>
          <p className="text-xs text-[#64748b]">Total PnL</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(!editing)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              editing ? "bg-[#7c3aed]/20 text-[#a78bfa] border-[#7c3aed]/40" : "text-[#64748b] border-[#1e2130] hover:text-white"
            }`}
          >
            ✎ Edit
          </button>
          <button
            onClick={() => void onToggle(bot.id, bot.status)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
              bot.status === "RUNNING"
                ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                : "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/20"
            }`}
          >
            {bot.status === "RUNNING" ? "Stop" : "Start"}
          </button>
          <button
            onClick={() => void onDelete(bot.id)}
            className="px-3 py-2 rounded-xl text-xs text-[#64748b] border border-[#1e2130] hover:text-red-400 hover:border-red-500/30 transition-colors"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="border-t border-[#1e2130] bg-[#0a0d14] p-5 space-y-4">
          {isGrid && (
            <div className="p-3 rounded-xl border border-[#1e2130] bg-[#0f1117] text-xs flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold mb-0.5">
                  {livePrice ? `Live price: $${livePrice.toLocaleString()}` : "Fetch live price to auto-fill grid range"}
                </p>
                <p className="text-[#64748b]">
                  {livePrice
                    ? `Range pre-filled ±12% — adjust the levels below then save`
                    : "Grid must bracket the current market price — Low &lt; Price &lt; High"}
                </p>
              </div>
              <button
                onClick={() => void fetchLivePrice()}
                disabled={fetchingPrice}
                className="flex-shrink-0 px-3 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-semibold rounded-xl hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
              >
                {fetchingPrice ? "Fetching…" : livePrice ? "↻ Refresh" : "📍 Get Price"}
              </button>
            </div>
          )}

          {hasGridError && !livePrice && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-red-400">
              ❌ <strong>Grid bounds missing or invalid.</strong> Click &quot;📍 Get Price&quot; above to auto-fill a valid range around the current price.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Amount per Order (USDT)</label>
              <input type="number" value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
            </div>

            {(bot.strategy === "DCA" || bot.strategy === "RSI" || bot.strategy === "MACD") && (
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Check Interval</label>
                <select value={editForm.interval} onChange={e => setEditForm(f => ({ ...f, interval: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50">
                  <option value="1h">Every 1 hour</option>
                  <option value="4h">Every 4 hours</option>
                  <option value="24h">Every 24 hours</option>
                </select>
              </div>
            )}

            {isGrid && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Low Price ($)</label>
                  <input type="number" value={editForm.gridLow}
                    onChange={e => setEditForm(f => ({ ...f, gridLow: e.target.value }))}
                    placeholder="e.g. 95000"
                    className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50 placeholder-[#475569]" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid High Price ($)</label>
                  <input type="number" value={editForm.gridHigh}
                    onChange={e => setEditForm(f => ({ ...f, gridHigh: e.target.value }))}
                    placeholder="e.g. 115000"
                    className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50 placeholder-[#475569]" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Levels</label>
                  <input type="number" value={editForm.gridLevels}
                    onChange={e => setEditForm(f => ({ ...f, gridLevels: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
                  <p className="text-[10px] text-[#475569] mt-1">Number of buy zones within the range</p>
                </div>
              </>
            )}

            {isRSI && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Buy Below (oversold)</label>
                  <input type="number" value={editForm.rsiLow}
                    onChange={e => setEditForm(f => ({ ...f, rsiLow: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Exit Above (overbought)</label>
                  <input type="number" value={editForm.rsiHigh}
                    onChange={e => setEditForm(f => ({ ...f, rsiHigh: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void saveConfig()}
              disabled={saving}
              className="px-5 py-2.5 bg-[#00ff88] text-black font-bold rounded-xl hover:bg-[#00cc6a] text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Config"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-5 py-2.5 border border-[#1e2130] text-[#64748b] rounded-xl hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BotRunResult { botId: string; name: string; result: string; }

function BotDiagnostics({ autoRun = false }: { autoRun?: boolean }) {
  const [running, setRunning]   = useState(false);
  const [results, setResults]   = useState<BotRunResult[] | null>(null);
  const [ranAt,   setRanAt]     = useState<string | null>(null);
  const [error,   setError]     = useState<string | null>(null);

  async function runNow() {
    setRunning(true);
    setResults(null);
    setError(null);
    try {
      const res  = await fetch("/api/bots/run", { method: "POST" });
      const data = await res.json() as { results: BotRunResult[]; ranAt: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setResults(data.results);
      setRanAt(data.ranAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoRun) void runNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resultColor(msg: string) {
    if (msg.includes("BUY") || msg.includes("Paper BUY") || msg.includes("Live BUY")) return "#00ff88";
    if (msg.includes("Error") || msg.includes("failed") || msg.includes("invalid")) return "#ef4444";
    if (msg.includes("not due") || msg.includes("outside range") || msg.includes("not near")) return "#f59e0b";
    return "#94a3b8";
  }

  function resultIcon(msg: string) {
    if (msg.includes("BUY"))    return "✅";
    if (msg.includes("Error") || msg.includes("invalid")) return "❌";
    if (msg.includes("not due") || msg.includes("outside") || msg.includes("not near")) return "⏳";
    return "ℹ️";
  }

  return (
    <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Bot Engine Status</p>
          <p className="text-xs text-[#64748b] mt-0.5">
            Auto-runs every 30 min via Netlify scheduler · {ranAt ? `Last run: ${new Date(ranAt).toLocaleTimeString()}` : "Not run this session"}
          </p>
        </div>
        <button
          onClick={() => void runNow()}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] border border-[#2d3548] hover:border-[#00ff88]/40 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          {running ? (
            <><span className="inline-block w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Running...</>
          ) : (
            <>▶ Run Bots Now</>
          )}
        </button>
      </div>

      {error && (
        <div className="px-5 pb-4 text-xs text-red-400 bg-red-400/5 border-t border-red-400/20 py-3">
          ❌ {error}
        </div>
      )}

      {results && (
        <div className="border-t border-[#1e2130]">
          {results.length === 0 ? (
            <p className="px-5 py-4 text-xs text-[#64748b]">No RUNNING bots found</p>
          ) : (
            <div className="divide-y divide-[#1e2130]">
              {results.map((r) => (
                <div key={r.botId} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-sm flex-shrink-0 mt-0.5">{resultIcon(r.result)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{r.name}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: resultColor(r.result) }}>
                      {r.result}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-[#1e2130] bg-[#0a0d14]">
            <p className="text-[10px] text-[#475569]">
              ⏳ = Conditions not met yet (waiting for interval / price range) &nbsp;·&nbsp;
              ✅ = Trade executed &nbsp;·&nbsp;
              ❌ = Error — check bot config
            </p>
          </div>
        </div>
      )}

      {!results && !running && !error && (
        <div className="px-5 pb-4 border-t border-[#1e2130] pt-3">
          <p className="text-xs text-[#475569]">
            Click <span className="text-white font-medium">Run Bots Now</span> to see exactly what each bot is doing — whether it traded, why it skipped, or if there&apos;s an error in its config.
          </p>
        </div>
      )}
    </div>
  );
}

function GridPriceHelper({ symbol, onSuggest }: { symbol: string; onSuggest: (lo: number, hi: number) => void }) {
  const [price, setPrice]     = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetch_() {
    setLoading(true);
    try {
      const res = await fetch(`/api/signals?symbol=${symbol}&interval=4h`);
      const data = await res.json() as { price?: number };
      if (data?.price) {
        setPrice(data.price);
        const lo = Math.round(data.price * 0.88 / 500) * 500;
        const hi = Math.round(data.price * 1.12 / 500) * 500;
        onSuggest(lo, hi);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-[#0a0d14] border border-[#1e2130] rounded-xl text-xs">
      <div>
        <p className="text-white font-semibold">
          {price ? `Current price: $${price.toLocaleString()} — range pre-filled ±12%` : "Need a starting point for grid bounds?"}
        </p>
        <p className="text-[#64748b] mt-0.5">Grid Low must be below and High above the current price</p>
      </div>
      <button
        onClick={() => void fetch_()}
        disabled={loading}
        className="flex-shrink-0 px-3 py-2 bg-[#00ff88]/10 border border-[#00ff88]/25 text-[#00ff88] font-semibold rounded-xl hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
      >
        {loading ? "Fetching…" : price ? "↻ Refresh" : "📍 Suggest Range"}
      </button>
    </div>
  );
}

function ExampleScenarios() {
  const [open, setOpen] = useState(false);

  const scenarios = [
    {
      icon: "🪙",
      tag: "CRYPTO — AUTO",
      tagColor: "#00ff88",
      title: "DCA Bot on Bitcoin",
      subtitle: "Set-and-forget accumulation",
      steps: [
        "Click + Analyze & Create Bot",
        "Select 🪙 Crypto tab, choose Bitcoin (BTC)",
        "Pick DCA strategy, set $50 per order, every 4 hours",
        'Click "✦ Ask Claude" — AI checks news + RSI + MACD',
        'If AI says BUY: click "Use This Config → Deploy Bot"',
        "Bot runs automatically — buys BTC every 4h when conditions align",
      ],
      result: "Example AI output: BUY · Entry $104,200 · SL $99,500 · TP $115,200 · RR 2.6:1",
      resultColor: "#00ff88",
    },
    {
      icon: "⛏",
      tag: "COMMODITY — ADVISORY",
      tagColor: "#f59e0b",
      title: "Gold Position Trade",
      subtitle: "Manual execution on your broker",
      steps: [
        "Click + Analyze & Create Bot",
        "Select ⛏ Commodity tab, choose Gold (GC=F)",
        'Click "✦ Ask Claude" — AI reads Reuters + Yahoo Finance news on gold',
        "Review: Action (BUY/SELL/HOLD), Entry, Stop Loss, Take Profit",
        "Open MetaTrader 4/5 or IC Markets",
        "Place a BUY order at the Entry price with SL and TP from the AI",
      ],
      result: "Example AI output: BUY Gold · Entry $3,280 · SL $3,214 · TP $3,424 · RR 2.2:1",
      resultColor: "#f59e0b",
    },
    {
      icon: "💱",
      tag: "FOREX — ADVISORY",
      tagColor: "#3b82f6",
      title: "EUR/USD Short Trade",
      subtitle: "News-enhanced forex signal",
      steps: [
        "Click + Analyze & Create Bot",
        "Select 💱 Forex tab, choose EUR/USD",
        'Click "✦ Ask Claude" — AI reads MarketWatch + Reuters macro news',
        "If AI says SELL: it means EUR is weakening vs USD — go short",
        "Copy Entry 1.0842 · SL 1.0929 · TP 1.0652 to your broker",
        "On MT4: New Order → Sell, set SL and TP → OK",
      ],
      result: "Example AI output: SELL EUR/USD · Entry 1.0842 · SL 1.0929 · TP 1.0652 · RR 2.2:1",
      resultColor: "#3b82f6",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#1e2130] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#0f1117] hover:bg-[#131720] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📖</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">How to Use — 3 Example Workflows</p>
            <p className="text-xs text-[#64748b]">Crypto auto-bot · Gold advisory · Forex short — step by step</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-[#64748b] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#1e2130] p-5 bg-[#0a0d14] space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {scenarios.map((s) => (
              <div key={s.title} className="bg-[#0f1117] border border-white/5 rounded-2xl p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s.icon}</span>
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                      style={{ background: `${s.tagColor}18`, color: s.tagColor }}
                    >
                      {s.tag}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white">{s.title}</p>
                  <p className="text-xs text-[#64748b]">{s.subtitle}</p>
                </div>

                <ol className="space-y-1.5">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: `${s.tagColor}20`, color: s.tagColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[#94a3b8] leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>

                <div
                  className="rounded-xl p-3 text-[10px] font-medium leading-relaxed"
                  style={{ background: `${s.tagColor}0d`, color: s.tagColor, border: `1px solid ${s.tagColor}25` }}
                >
                  {s.result}
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0f1117] border border-white/5 rounded-xl p-3">
              <p className="text-white font-semibold mb-1.5">What the AI levels mean</p>
              <p className="text-[#94a3b8] leading-relaxed">
                <span className="text-white">Entry</span> — open your trade here &nbsp;·&nbsp;
                <span className="text-red-400">Stop Loss</span> — your maximum loss, place this order simultaneously &nbsp;·&nbsp;
                <span className="text-[#00ff88]">Take Profit</span> — your target, auto-close here &nbsp;·&nbsp;
                <span className="text-[#a78bfa]">RR 2.2:1</span> — you risk $1 to gain $2.20
              </p>
            </div>
            <div className="bg-[#0f1117] border border-white/5 rounded-xl p-3">
              <p className="text-white font-semibold mb-1.5">Crypto vs Commodity/Forex</p>
              <p className="text-[#94a3b8] leading-relaxed">
                <span className="text-[#00ff88]">Crypto</span> bots deploy directly to Binance — fully automated once approved. &nbsp;
                <span className="text-[#f59e0b]">Commodity/Forex</span> is advisory — the AI gives you the exact levels, you enter them manually on MT4/MT5 or any CFD broker.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BotsPage() {
  const [bots, setBots]     = useState<Bot[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rec, setRec]           = useState<BotRecommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [recError, setRecError]     = useState<string | null>(null);
  const [assetClass, setAssetClass] = useState<AssetCategory>("crypto");
  const [showAllNews, setShowAllNews] = useState(false);
  const [aiProvider,  setAiProvider]  = useState<AIProvider>("claude");
  const [nimModel,    setNimModel]    = useState<NimModelId>(DEFAULT_NIM_MODEL);
  const [kimiModel,   setKimiModel]   = useState<KimiModelId>(DEFAULT_KIMI_MODEL);

  const assetPairs =
    assetClass === "crypto" ? CRYPTO_PAIRS
    : assetClass === "commodity" ? COMMODITY_PAIRS
    : FOREX_PAIRS;

  async function fetchBots() {
    try {
      const res = await fetch("/api/bots");
      const data = await res.json() as { bots?: Bot[] };
      setBots(data.bots ?? []);
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchBots(); }, []);

  // When asset class changes, reset symbol to first pair of that class
  function switchAssetClass(cls: AssetCategory) {
    setAssetClass(cls);
    setRec(null);
    setRecError(null);
    const pairs = cls === "crypto" ? CRYPTO_PAIRS : cls === "commodity" ? COMMODITY_PAIRS : FOREX_PAIRS;
    setForm(f => ({ ...f, symbol: pairs[0]?.symbol ?? "" }));
  }

  async function askAI() {
    setLoadingRec(true);
    setRecError(null);
    setRec(null);
    setShowAllNews(false);
    try {
      const res = await fetch("/api/advisor/bot-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol:   form.symbol,
          category: assetClass,
          provider:   aiProvider,
          nimModel:   aiProvider === "nim"  ? nimModel  : undefined,
          kimiModel:  aiProvider === "kimi" ? kimiModel : undefined,
        }),
      });
      const data = await res.json() as BotRecommendation & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setRec(data);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setLoadingRec(false);
    }
  }

  function applyRecommendation() {
    if (!rec) return;
    const cfg = rec.config as Record<string, unknown>;
    setForm({
      name:       rec.name,
      strategy:   rec.strategy,
      symbol:     rec.symbol,
      interval:   (cfg.interval as string) ?? "4h",
      amount:     String(cfg.amount ?? 50),
      rsiLow:     String(cfg.rsiLow ?? 32),
      rsiHigh:    String(cfg.rsiHigh ?? 68),
      gridLow:    String(cfg.gridLow ?? ""),
      gridHigh:   String(cfg.gridHigh ?? ""),
      gridLevels: String(cfg.gridLevels ?? 8),
    });
    setRec(null);
  }

  async function createBot() {
    setFormError(null);
    if (form.strategy === "GRID") {
      const lo = parseFloat(form.gridLow);
      const hi = parseFloat(form.gridHigh);
      if (!form.gridLow || !form.gridHigh || isNaN(lo) || isNaN(hi) || lo >= hi) {
        setFormError("Grid strategy requires a Low price less than High price. Both values must bracket the current market price.");
        return;
      }
    }
    setCreating(true);
    const config: Record<string, unknown> = { interval: form.interval, amount: parseFloat(form.amount) };
    if (form.strategy === "RSI")  { config.rsiLow = parseFloat(form.rsiLow); config.rsiHigh = parseFloat(form.rsiHigh); }
    if (form.strategy === "GRID") {
      config.gridLow    = parseFloat(form.gridLow);
      config.gridHigh   = parseFloat(form.gridHigh);
      config.gridLevels = parseInt(form.gridLevels);
    }

    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, strategy: form.strategy, symbol: form.symbol, config }),
    });

    if (res.ok) {
      setShowForm(false);
      setForm(DEFAULT_FORM);
      setRec(null);
      void fetchBots();
    }
    setCreating(false);
  }

  async function toggleBot(id: string, status: string) {
    await fetch("/api/bots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: status === "RUNNING" ? "STOPPED" : "RUNNING" }),
    });
    void fetchBots();
  }

  async function deleteBot(id: string) {
    await fetch(`/api/bots?id=${id}`, { method: "DELETE" });
    void fetchBots();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Bots & AI Advisor</h1>
          <p className="text-[#64748b] text-sm mt-1">
            News-enhanced AI analysis across Crypto · Commodities · Forex — click <span className="text-purple-400 font-medium">Ask Claude</span> on any asset
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setRec(null); setRecError(null); }}
          className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
        >
          + Analyze & Create Bot
        </button>
      </div>

      {/* ── How to Use / Example Scenarios ──────────────────────────────── */}
      <ExampleScenarios />

      {/* ── Strategy overview cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STRATEGIES.map((s) => (
          <div
            key={s.id}
            className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-4 hover:border-[#00ff88]/30 transition-colors cursor-pointer"
            onClick={() => { setForm(f => ({ ...f, strategy: s.id })); setShowForm(true); setRec(null); }}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <h3 className="font-semibold text-white text-sm">{s.label}</h3>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Create / Analyze Form ────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-[#0f1117] border border-[#00ff88]/30 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-white">AI Analysis + Bot Configuration</h2>

          {/* Asset class tabs */}
          <div className="flex gap-0 rounded-xl overflow-hidden border border-[#1e2130] w-fit">
            {(["crypto", "commodity", "forex"] as AssetCategory[]).map((cls) => (
              <button
                key={cls}
                onClick={() => switchAssetClass(cls)}
                className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                  assetClass === cls
                    ? "bg-[#7c3aed] text-white"
                    : "bg-[#0f1117] text-[#64748b] hover:text-white"
                }`}
              >
                {cls === "crypto" ? "🪙 Crypto" : cls === "commodity" ? "⛏ Commodity" : "💱 Forex"}
              </button>
            ))}
          </div>

          {assetClass !== "crypto" && (
            <div className="flex items-center gap-2 p-3 bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-xl text-xs text-[#f59e0b]">
              ⚠ <span><strong>Advisory Mode</strong> — AI analysis works for all asset classes, but auto-execution only works for Crypto (Binance). For Commodities and Forex, use the AI recommendation to trade on your broker manually.</span>
            </div>
          )}

          {/* Form fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Bot Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My AI Strategy Bot"
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Strategy</label>
              <select value={form.strategy} onChange={e => setForm(f => ({ ...f, strategy: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm">
                {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Asset</label>
              <select
                value={form.symbol}
                onChange={e => { setForm(f => ({ ...f, symbol: e.target.value })); setRec(null); }}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              >
                {assetPairs.map(p => <option key={p.symbol} value={p.symbol}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Amount per Order (USDT)</label>
              <input type="number" min="15" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
              <p className="text-xs text-[#475569] mt-1">Min $15 (Binance $10 minimum + buffer)</p>
            </div>

            {(form.strategy === "DCA" || form.strategy === "RSI" || form.strategy === "MACD") && (
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Check Interval</label>
                <select value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm">
                  {form.strategy === "DCA" && <option value="30m">Every 30 min</option>}
                  <option value="1h">Every 1 hour</option>
                  <option value="4h">Every 4 hours</option>
                  {form.strategy === "DCA" && <option value="12h">Every 12 hours</option>}
                  {form.strategy === "DCA" && <option value="24h">Every 24 hours</option>}
                </select>
              </div>
            )}

            {form.strategy === "RSI" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Buy Below (oversold)</label>
                  <input type="number" value={form.rsiLow} onChange={e => setForm(f => ({ ...f, rsiLow: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Exit Above (overbought)</label>
                  <input type="number" value={form.rsiHigh} onChange={e => setForm(f => ({ ...f, rsiHigh: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
              </>
            )}

            {form.strategy === "GRID" && (
              <>
                <div className="col-span-2">
                  <GridPriceHelper symbol={form.symbol} onSuggest={(lo, hi) => setForm(f => ({ ...f, gridLow: String(lo), gridHigh: String(hi) }))} />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Low Price</label>
                  <input type="number" value={form.gridLow} onChange={e => setForm(f => ({ ...f, gridLow: e.target.value }))}
                    placeholder="e.g. 90000" className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid High Price</label>
                  <input type="number" value={form.gridHigh} onChange={e => setForm(f => ({ ...f, gridHigh: e.target.value }))}
                    placeholder="e.g. 110000" className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Levels</label>
                  <input type="number" value={form.gridLevels} onChange={e => setForm(f => ({ ...f, gridLevels: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
              </>
            )}
          </div>

          {/* ── AI Intelligence Panel ──────────────────────────────────── */}
          <div className="border border-[#1e2130] rounded-2xl overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3 bg-[#0a0d14] gap-3 flex-wrap">
              <div>
                <span className="text-sm font-medium text-white">AI Investment Intelligence</span>
                <span className="text-xs text-[#64748b] ml-2">— Technical analysis + live news</span>
                {/* Provider toggle */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-[#475569] uppercase tracking-wider">AI Model:</span>
                  <div className="flex rounded-lg overflow-hidden border border-[#1e2130]">
                    <button
                      onClick={() => setAiProvider("claude")}
                      className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                        aiProvider === "claude" ? "bg-[#7c3aed] text-white" : "bg-[#0f1117] text-[#64748b] hover:text-white"
                      }`}
                    >
                      ✦ Claude
                    </button>
                    <button
                      onClick={() => setAiProvider("nim")}
                      className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                        aiProvider === "nim" ? "bg-[#76b900] text-black" : "bg-[#0f1117] text-[#64748b] hover:text-white"
                      }`}
                    >
                      ⚡ NVIDIA NIM
                    </button>
                    <button
                      onClick={() => setAiProvider("kimi")}
                      className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                        aiProvider === "kimi" ? "bg-[#0ea5e9] text-black" : "bg-[#0f1117] text-[#64748b] hover:text-white"
                      }`}
                    >
                      ✦ Kimi
                    </button>
                  </div>
                  {aiProvider === "nim" && (
                    <select
                      value={nimModel}
                      onChange={e => setNimModel(e.target.value as NimModelId)}
                      className="px-2 py-1 bg-[#0f1117] border border-[#1e2130] rounded-lg text-[10px] text-white focus:outline-none focus:border-[#76b900]/50"
                    >
                      {NIM_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} ({m.badge})</option>
                      ))}
                    </select>
                  )}
                  {aiProvider === "kimi" && (
                    <select
                      value={kimiModel}
                      onChange={e => setKimiModel(e.target.value as KimiModelId)}
                      className="px-2 py-1 bg-[#0f1117] border border-[#1e2130] rounded-lg text-[10px] text-white focus:outline-none focus:border-[#0ea5e9]/50"
                    >
                      {KIMI_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} ({m.badge})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <button
                onClick={() => void askAI()}
                disabled={loadingRec}
                className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
                  aiProvider === "nim"
                    ? "bg-[#76b900] text-black hover:bg-[#5e9400]"
                    : aiProvider === "kimi"
                    ? "bg-[#0ea5e9] text-black hover:bg-[#0284c7]"
                    : "bg-purple-600 text-white hover:bg-purple-500"
                }`}
              >
                {loadingRec ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : aiProvider === "nim" ? (
                  <>⚡ Ask NIM</>
                ) : aiProvider === "kimi" ? (
                  <>✦ Ask Kimi</>
                ) : (
                  <>✦ Ask Claude</>
                )}
              </button>
            </div>

            {recError && (
              <div className="px-4 py-3 bg-red-500/5 border-t border-red-500/20 text-red-400 text-sm">
                {recError}
              </div>
            )}

            {rec && (
              <div className="p-4 bg-[#0a0d14] border-t border-[#1e2130] space-y-4">

                {/* Action banner */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${ACTION_COLORS[rec.action]}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black">{rec.action === "BUY" ? "▲" : rec.action === "SELL" ? "▼" : "⬦"}</span>
                    <div>
                      <p className="font-bold text-base">{rec.action} {rec.symbol.replace("USDT", "").replace("=X", "").replace("=F", "")}</p>
                      <p className="text-xs opacity-75">{rec.actionReason}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-black">{rec.confidence}%</p>
                    <p className="text-[10px] opacity-60">AI confidence</p>
                  </div>
                </div>

                {/* Strategy + phase */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{STRATEGIES.find(s => s.id === rec.strategy)?.icon}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">{rec.name}</p>
                      <p className="text-xs text-[#64748b]">{rec.strategy} strategy</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${PHASE_COLORS[rec.marketPhase] ?? ""}`}>
                      {rec.marketPhase.replace(/_/g, " ")}
                    </span>
                    {rec.executionMode === "ADVISORY" && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full border text-yellow-400 bg-yellow-400/10 border-yellow-400/30">
                        ADVISORY
                      </span>
                    )}
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-sm text-[#94a3b8] leading-relaxed">{rec.rationale}</p>

                {/* ── Trade Levels ──────────────────────────────────────── */}
                <div>
                  <p className="text-xs text-[#64748b] uppercase tracking-wider mb-2">Trade Levels</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Entry",       value: formatLevel(rec.entryPrice,  rec.category), color: "text-white"        },
                      { label: "Stop Loss",   value: formatLevel(rec.stopLoss,    rec.category), color: "text-red-400"      },
                      { label: "Take Profit", value: formatLevel(rec.takeProfit,  rec.category), color: "text-[#00ff88]"    },
                      { label: "Risk/Reward", value: `${rec.riskReward}:1`,                      color: "text-[#a78bfa]"    },
                    ].map(item => (
                      <div key={item.label} className="bg-[#0f1117] border border-white/5 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-[#64748b] mb-1">{item.label}</p>
                        <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── News Intelligence ─────────────────────────────────── */}
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📰</span>
                      <p className="text-xs font-semibold text-white">News Intelligence</p>
                      {rec.newsContext.sources.length > 0 && (
                        <span className="text-[10px] text-[#475569]">
                          via {rec.newsContext.sources.join(", ")}
                        </span>
                      )}
                    </div>
                    <SentimentBadge sentiment={rec.newsContext.sentiment} />
                  </div>

                  {rec.newsContext.headlines.length > 0 ? (
                    <>
                      <div className="flex items-center gap-4 mb-3 text-xs text-[#64748b]">
                        <span>🟢 {rec.newsContext.bullishCount} bullish</span>
                        <span>🔴 {rec.newsContext.bearishCount} bearish</span>
                        <span className="text-white font-semibold">
                          Score: {rec.newsContext.sentimentScore > 0 ? "+" : ""}{rec.newsContext.sentimentScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(showAllNews ? rec.newsContext.headlines : rec.newsContext.headlines.slice(0, 4)).map((h, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-[#475569] flex-shrink-0 mt-0.5">{i + 1}.</span>
                            <span className="text-[#94a3b8] leading-relaxed">{h}</span>
                          </div>
                        ))}
                      </div>
                      {rec.newsContext.headlines.length > 4 && (
                        <button
                          onClick={() => setShowAllNews(!showAllNews)}
                          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {showAllNews ? "Show less ▲" : `Show ${rec.newsContext.headlines.length - 4} more headlines ▼`}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#475569]">No news headlines retrieved — recommendation based on technical analysis only.</p>
                  )}
                </div>

                {/* ── Raw Market Data ───────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    {
                      label: "ADX",
                      value: rec.rawMarketData.adx.toFixed(1),
                      sub: rec.rawMarketData.adx > 25 ? "Trending" : "Ranging",
                      color: rec.rawMarketData.adx > 25 ? "text-[#00ff88]" : "text-[#f59e0b]",
                    },
                    {
                      label: rec.rawMarketData.dataInterval === "daily" ? "RSI (14D)" : "RSI 1H",
                      value: rec.rawMarketData.rsi1h.toFixed(1),
                      sub: rec.rawMarketData.rsi1h < 35 ? "Oversold" : rec.rawMarketData.rsi1h > 65 ? "Overbought" : "Neutral",
                      color: rec.rawMarketData.rsi1h < 35 ? "text-[#00ff88]" : rec.rawMarketData.rsi1h > 65 ? "text-red-400" : "text-white",
                    },
                    {
                      label: "BB Width",
                      value: `${(rec.rawMarketData.bbWidth * 100).toFixed(2)}%`,
                      sub: rec.rawMarketData.bbWidth < 0.015 ? "Squeeze" : "Normal",
                      color: rec.rawMarketData.bbWidth < 0.015 ? "text-yellow-400" : "text-white",
                    },
                    {
                      label: "Volume",
                      value: `${rec.rawMarketData.volumeRatio.toFixed(2)}x`,
                      sub: rec.rawMarketData.volumeRatio > 1.5 ? "Surge" : "Normal",
                      color: rec.rawMarketData.volumeRatio > 1.5 ? "text-[#00ff88]" : "text-white",
                    },
                  ].map(item => (
                    <div key={item.label} className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-2">
                      <p className="text-[#64748b] mb-1">{item.label}</p>
                      <p className={`font-semibold ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-[#475569] mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Strategy config preview */}
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-3">
                  <p className="text-xs text-[#64748b] mb-2 font-medium uppercase tracking-wider">Bot Config</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(rec.config).map(([k, v]) => (
                      <span key={k} className="px-2.5 py-1 bg-[#1a1f2e] rounded-lg text-xs text-white">
                        <span className="text-[#64748b]">{k}: </span>
                        {typeof v === "number" && v > 100 ? `$${v.toLocaleString()}` : String(v)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Safety notes */}
                {rec.safetyNotes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#64748b] uppercase tracking-wider">Risk Notes</p>
                    {rec.safetyNotes.map((note, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[#64748b]">
                        <span className="text-[#f59e0b] shrink-0 mt-0.5">⚠</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                {rec.executionMode === "AUTO" ? (
                  <button
                    onClick={applyRecommendation}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Use This Config → Deploy Bot
                  </button>
                ) : (
                  <div className="w-full py-3 px-4 bg-[#f59e0b]/5 border border-[#f59e0b]/30 rounded-xl text-center">
                    <p className="text-xs text-[#f59e0b] font-semibold mb-0.5">Advisory Mode — Manual Execution Required</p>
                    <p className="text-[10px] text-[#64748b]">
                      Use the Entry / Stop Loss / Take Profit levels above when placing your trade on your broker (e.g. MetaTrader, IC Markets, Interactive Brokers)
                    </p>
                  </div>
                )}
              </div>
            )}

            {!rec && !loadingRec && !recError && (
              <div className="px-4 py-6 bg-[#0a0d14] border-t border-[#1e2130] text-center space-y-2">
                <p className="text-sm text-[#475569]">
                  Click <span className="text-purple-400 font-medium">Ask Claude</span> to analyze <span className="text-white">{assetPairs.find(p => p.symbol === form.symbol)?.label ?? form.symbol}</span>
                </p>
                <p className="text-xs text-[#475569]">
                  AI combines live price charts with news from Reuters · Yahoo Finance · MarketWatch · CoinDesk
                </p>
              </div>
            )}
          </div>

          {/* Form validation error */}
          {formError && (
            <div className="p-3 bg-red-500/5 border border-red-500/25 rounded-xl text-xs text-red-400">
              ❌ {formError}
            </div>
          )}

          {/* Deploy button (only for crypto) */}
          {assetClass === "crypto" && (
            <div className="flex gap-3">
              <button
                onClick={() => void createBot()}
                disabled={creating || !form.name}
                className="px-6 py-3 bg-[#00ff88] text-black font-bold rounded-xl hover:bg-[#00cc6a] transition-colors disabled:opacity-50 text-sm"
              >
                {creating ? "Deploying..." : "Deploy Bot"}
              </button>
              <button
                onClick={() => { setShowForm(false); setRec(null); setRecError(null); }}
                className="px-6 py-3 border border-[#1e2130] text-[#64748b] rounded-xl hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {assetClass !== "crypto" && (
            <button
              onClick={() => { setShowForm(false); setRec(null); setRecError(null); }}
              className="px-6 py-3 border border-[#1e2130] text-[#64748b] rounded-xl hover:text-white text-sm transition-colors"
            >
              Close
            </button>
          )}
        </div>
      )}

      {/* ── Bot Diagnostics — Run Now ────────────────────────────────────── */}
      {bots.length > 0 && (
        <BotDiagnostics autoRun={bots.some(b => b.status === "RUNNING")} />
      )}

      {/* ── Active Bots List ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-[#64748b]">Loading bots...</div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1117] border border-[#1e2130] rounded-2xl">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-white mb-2">No bots running yet</h3>
          <p className="text-[#64748b] text-sm mb-1 max-w-sm mx-auto">
            Click <strong>Analyze & Create Bot</strong>, select any Crypto, Commodity, or Forex asset, then hit <strong>Ask Claude</strong> for a news-enhanced recommendation.
          </p>
          <p className="text-[#475569] text-xs mb-4">Auto-execution available for Crypto · Advisory mode for Commodities & Forex</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
          >
            + Get Started
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Running Bots ({bots.length})</h2>
            <div className="flex items-center gap-3 text-xs text-[#64748b]">
              {(() => {
                const healthy = bots.filter(b => {
                  if (b.strategy !== "GRID") return true;
                  const c = b.config as Record<string, unknown>;
                  return c.gridLow && c.gridHigh && Number(c.gridLow) < Number(c.gridHigh);
                }).length;
                const errors = bots.length - healthy;
                return (
                  <>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />{healthy} healthy</span>
                    {errors > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{errors} need config</span>}
                  </>
                );
              })()}
            </div>
          </div>
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onToggle={toggleBot} onDelete={deleteBot} onRefresh={fetchBots} />
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-[#1a1f2e] text-xs text-[#475569] text-center">
        ⚠️ AI recommendations combine technical indicators with news sentiment — not financial advice. News sourced from public RSS feeds (Yahoo Finance, Reuters, MarketWatch, CoinDesk). Always verify before executing any trade.
      </div>
    </div>
  );
}
