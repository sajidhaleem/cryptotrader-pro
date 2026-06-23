"use client";

import { useEffect, useState } from "react";
import type { BotRecommendation } from "@/lib/bot-advisor";

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
  { id: "DCA",  label: "DCA",      desc: "Dollar Cost Averaging — buys at fixed intervals regardless of price",           icon: "📅" },
  { id: "GRID", label: "Grid",     desc: "Places buy orders at regular price intervals within a defined range",            icon: "🔲" },
  { id: "RSI",  label: "RSI Bot",  desc: "Buys when RSI < threshold (oversold), exits when overbought",                   icon: "📊" },
  { id: "MACD", label: "MACD",     desc: "Trades on MACD histogram zero-line crossover — best in trending markets",       icon: "📈" },
];

const ALL_PAIRS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT",
  "DOGEUSDT", "XRPUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT",
  "MATICUSDT", "LTCUSDT",
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

const DEFAULT_FORM = {
  name: "", strategy: "DCA", symbol: "BTCUSDT",
  interval: "4h", amount: "50",
  rsiLow: "32", rsiHigh: "68",
  gridLow: "", gridHigh: "", gridLevels: "8",
};

export default function BotsPage() {
  const [bots, setBots]               = useState<Bot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(DEFAULT_FORM);
  const [creating, setCreating]       = useState(false);
  const [rec, setRec]                 = useState<BotRecommendation | null>(null);
  const [loadingRec, setLoadingRec]   = useState(false);
  const [recError, setRecError]       = useState<string | null>(null);

  async function fetchBots() {
    try {
      const res = await fetch("/api/bots");
      const data = await res.json() as { bots?: Bot[] };
      setBots(data.bots ?? []);
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchBots(); }, []);

  async function askAI() {
    setLoadingRec(true);
    setRecError(null);
    setRec(null);
    try {
      const res = await fetch("/api/advisor/bot-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: form.symbol }),
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

  async function toggleBot(id: string, currentStatus: string) {
    const newStatus = currentStatus === "RUNNING" ? "STOPPED" : "RUNNING";
    await fetch("/api/bots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    void fetchBots();
  }

  async function deleteBot(id: string) {
    await fetch(`/api/bots?id=${id}`, { method: "DELETE" });
    void fetchBots();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Bots</h1>
          <p className="text-[#64748b] text-sm mt-1">Automate your strategy — AI recommends the best bot for current conditions</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setRec(null); setRecError(null); }}
          className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
        >
          + Create Bot
        </button>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STRATEGIES.map((s) => (
          <div
            key={s.id}
            className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-4 hover:border-[#00ff88]/30 transition-colors cursor-pointer"
            onClick={() => { setForm((f) => ({ ...f, strategy: s.id })); setShowForm(true); setRec(null); }}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <h3 className="font-semibold text-white text-sm">{s.label}</h3>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Create Bot Form */}
      {showForm && (
        <div className="bg-[#0f1117] border border-[#00ff88]/30 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-white">Configure New Bot</h2>

          {/* Basic fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Bot Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My DCA Bot"
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Strategy</label>
              <select
                value={form.strategy}
                onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              >
                {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Trading Pair</label>
              <select
                value={form.symbol}
                onChange={(e) => { setForm((f) => ({ ...f, symbol: e.target.value })); setRec(null); }}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              >
                {ALL_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Amount per Order (USDT)</label>
              <input
                type="number" min="15"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              />
              <p className="text-xs text-[#475569] mt-1">Min $15 (Binance enforces $10 minimum)</p>
            </div>

            {(form.strategy === "DCA" || form.strategy === "RSI" || form.strategy === "MACD") && (
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Check Interval</label>
                <select
                  value={form.interval}
                  onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
                >
                  {form.strategy === "DCA"  && <option value="30m">Every 30 minutes</option>}
                  <option value="1h">Every 1 hour</option>
                  <option value="4h">Every 4 hours</option>
                  {form.strategy === "DCA"  && <option value="12h">Every 12 hours</option>}
                  {form.strategy === "DCA"  && <option value="24h">Every 24 hours</option>}
                </select>
              </div>
            )}

            {form.strategy === "RSI" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Buy Below (oversold)</label>
                  <input type="number" value={form.rsiLow} onChange={(e) => setForm((f) => ({ ...f, rsiLow: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Exit Above (overbought)</label>
                  <input type="number" value={form.rsiHigh} onChange={(e) => setForm((f) => ({ ...f, rsiHigh: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
              </>
            )}

            {form.strategy === "GRID" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Low Price ($)</label>
                  <input type="number" value={form.gridLow} onChange={(e) => setForm((f) => ({ ...f, gridLow: e.target.value }))}
                    placeholder="e.g. 90000"
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid High Price ($)</label>
                  <input type="number" value={form.gridHigh} onChange={(e) => setForm((f) => ({ ...f, gridHigh: e.target.value }))}
                    placeholder="e.g. 110000"
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Levels</label>
                  <input type="number" value={form.gridLevels} onChange={(e) => setForm((f) => ({ ...f, gridLevels: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                  <p className="text-xs text-[#475569] mt-1">6-12 levels recommended (wider gaps = safer)</p>
                </div>
              </>
            )}
          </div>

          {/* AI Recommendation Panel */}
          <div className="border border-[#1e2130] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0a0d14]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">AI Strategy Advisor</span>
                <span className="text-xs text-[#64748b]">— Claude analyzes {form.symbol} live market conditions</span>
              </div>
              <button
                onClick={() => void askAI()}
                disabled={loadingRec}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {loadingRec ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
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
                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {STRATEGIES.find((s) => s.id === rec.strategy)?.icon ?? "🤖"}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{rec.name}</p>
                      <p className="text-xs text-[#64748b]">{rec.strategy} strategy · {rec.confidence}% confidence</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${PHASE_COLORS[rec.marketPhase] ?? "text-white border-white/20"}`}>
                    {rec.marketPhase.replace("_", " ")}
                  </span>
                </div>

                {/* Rationale */}
                <p className="text-sm text-[#94a3b8] leading-relaxed">{rec.rationale}</p>

                {/* Config preview */}
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-3">
                  <p className="text-xs text-[#64748b] mb-2 font-medium uppercase tracking-wider">Recommended Config</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(rec.config).map(([k, v]) => (
                      <span key={k} className="px-2.5 py-1 bg-[#1a1f2e] rounded-lg text-xs text-white">
                        <span className="text-[#64748b]">{k}: </span>
                        {typeof v === "number" && v > 100 ? `$${v.toLocaleString()}` : String(v)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Market data */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-2">
                    <p className="text-[#64748b]">ADX (4H)</p>
                    <p className="text-white font-medium">{rec.rawMarketData.adx.toFixed(1)}</p>
                  </div>
                  <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-2">
                    <p className="text-[#64748b]">RSI 1H</p>
                    <p className={`font-medium ${rec.rawMarketData.rsi1h < 32 ? "text-[#00ff88]" : rec.rawMarketData.rsi1h > 68 ? "text-red-400" : "text-white"}`}>
                      {rec.rawMarketData.rsi1h.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-2">
                    <p className="text-[#64748b]">BB Width</p>
                    <p className="text-white font-medium">{(rec.rawMarketData.bbWidth * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-[#0f1117] border border-[#1e2130] rounded-lg p-2">
                    <p className="text-[#64748b]">Volume</p>
                    <p className={`font-medium ${rec.rawMarketData.volumeRatio > 1.5 ? "text-[#00ff88]" : "text-white"}`}>
                      {rec.rawMarketData.volumeRatio.toFixed(2)}x
                    </p>
                  </div>
                </div>

                {/* Safety notes */}
                {rec.safetyNotes.length > 0 && (
                  <div className="space-y-1">
                    {rec.safetyNotes.map((note, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[#64748b]">
                        <span className="text-[#00ff88] shrink-0 mt-0.5">✓</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={applyRecommendation}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  Use This Configuration →
                </button>
              </div>
            )}

            {!rec && !loadingRec && !recError && (
              <div className="px-4 py-5 bg-[#0a0d14] border-t border-[#1e2130] text-center text-[#475569] text-sm">
                Click <span className="text-purple-400 font-medium">Ask Claude</span> to analyze {form.symbol} and get an AI-recommended bot strategy with pre-filled config
              </div>
            )}
          </div>

          {/* Action buttons */}
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
        </div>
      )}

      {/* Bot list */}
      {loading ? (
        <div className="text-center py-12 text-[#64748b]">Loading bots...</div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1117] border border-[#1e2130] rounded-2xl">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-white mb-2">No bots yet</h3>
          <p className="text-[#64748b] text-sm mb-4">Create your first bot — or let Claude recommend one based on live market conditions</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
          >
            + Create First Bot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5 flex items-center gap-4">
              <div className="text-2xl">
                {STRATEGIES.find((s) => s.id === bot.strategy)?.icon ?? "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">{bot.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[bot.status]}`}>
                    {bot.status}
                  </span>
                </div>
                <p className="text-xs text-[#64748b]">
                  {bot.strategy} · {bot.symbol} · {bot.totalTrades} trades
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold text-sm ${bot.totalPnl >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                  {bot.totalPnl >= 0 ? "+" : ""}${bot.totalPnl.toFixed(2)}
                </p>
                <p className="text-xs text-[#64748b]">Total PnL</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggleBot(bot.id, bot.status)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    bot.status === "RUNNING"
                      ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                      : "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/20"
                  }`}
                >
                  {bot.status === "RUNNING" ? "Stop" : "Start"}
                </button>
                <button
                  onClick={() => void deleteBot(bot.id)}
                  className="px-3 py-2 rounded-xl text-xs text-[#64748b] border border-[#1e2130] hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
