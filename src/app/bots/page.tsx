"use client";

import { useEffect, useState } from "react";

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
  { id: "DCA", label: "DCA", desc: "Dollar Cost Averaging — buys at fixed intervals regardless of price", icon: "📅" },
  { id: "GRID", label: "Grid", desc: "Places buy/sell orders at regular price intervals in a range", icon: "🔲" },
  { id: "RSI", label: "RSI Bot", desc: "Buys when RSI < 30 (oversold), sells when RSI > 70 (overbought)", icon: "📊" },
  { id: "MACD", label: "MACD", desc: "Trades on MACD crossover signals", icon: "📈" },
];

const PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT"];

const STATUS_COLORS = {
  RUNNING: "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30",
  STOPPED: "text-[#64748b] bg-[#1a1f2e] border-[#1e2130]",
  PAUSED: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    strategy: "DCA",
    symbol: "BTCUSDT",
    interval: "1h",
    amount: "50",
    rsiLow: "30",
    rsiHigh: "70",
    gridLow: "",
    gridHigh: "",
    gridLevels: "10",
  });
  const [creating, setCreating] = useState(false);

  async function fetchBots() {
    const res = await fetch("/api/bots");
    const data = await res.json();
    setBots(data.bots ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchBots(); }, []);

  async function createBot() {
    setCreating(true);
    const config: Record<string, unknown> = { interval: form.interval, amount: parseFloat(form.amount) };
    if (form.strategy === "RSI") { config.rsiLow = parseFloat(form.rsiLow); config.rsiHigh = parseFloat(form.rsiHigh); }
    if (form.strategy === "GRID") { config.gridLow = parseFloat(form.gridLow); config.gridHigh = parseFloat(form.gridHigh); config.gridLevels = parseInt(form.gridLevels); }

    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, strategy: form.strategy, symbol: form.symbol, config }),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", strategy: "DCA", symbol: "BTCUSDT", interval: "1h", amount: "50", rsiLow: "30", rsiHigh: "70", gridLow: "", gridHigh: "", gridLevels: "10" });
      fetchBots();
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
    fetchBots();
  }

  async function deleteBot(id: string) {
    await fetch(`/api/bots?id=${id}`, { method: "DELETE" });
    fetchBots();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Bots</h1>
          <p className="text-[#64748b] text-sm mt-1">Automate your trading strategies 24/7</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-[#00ff88] text-black font-semibold rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
        >
          + Create Bot
        </button>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STRATEGIES.map((s) => (
          <div key={s.id} className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-4 hover:border-[#00ff88]/30 transition-colors cursor-pointer" onClick={() => { setForm(f => ({ ...f, strategy: s.id })); setShowForm(true); }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <h3 className="font-semibold text-white text-sm">{s.label}</h3>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Create Bot Form */}
      {showForm && (
        <div className="bg-[#0f1117] border border-[#00ff88]/30 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-5">Configure New Bot</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Bot Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My DCA Bot"
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Strategy</label>
              <select
                value={form.strategy}
                onChange={(e) => setForm(f => ({ ...f, strategy: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              >
                {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Trading Pair</label>
              <select
                value={form.symbol}
                onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm"
              >
                {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#64748b] mb-1 block">Amount per Order (USDT)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm"
              />
            </div>

            {form.strategy === "RSI" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Buy Below</label>
                  <input type="number" value={form.rsiLow} onChange={(e) => setForm(f => ({ ...f, rsiLow: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">RSI Sell Above</label>
                  <input type="number" value={form.rsiHigh} onChange={(e) => setForm(f => ({ ...f, rsiHigh: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
              </>
            )}

            {form.strategy === "GRID" && (
              <>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid Low Price ($)</label>
                  <input type="number" value={form.gridLow} onChange={(e) => setForm(f => ({ ...f, gridLow: e.target.value }))}
                    placeholder="e.g. 95000"
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Grid High Price ($)</label>
                  <input type="number" value={form.gridHigh} onChange={(e) => setForm(f => ({ ...f, gridHigh: e.target.value }))}
                    placeholder="e.g. 110000"
                    className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={createBot}
              disabled={creating || !form.name}
              className="px-6 py-3 bg-[#00ff88] text-black font-bold rounded-xl hover:bg-[#00cc6a] transition-colors disabled:opacity-50 text-sm"
            >
              {creating ? "Creating..." : "Deploy Bot"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 py-3 border border-[#1e2130] text-[#64748b] rounded-xl hover:text-white text-sm transition-colors">
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
          <p className="text-[#64748b] text-sm">Create your first trading bot to automate your strategy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5 flex items-center gap-4">
              <div className="text-2xl">
                {STRATEGIES.find(s => s.id === bot.strategy)?.icon ?? "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">{bot.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[bot.status]}`}>
                    {bot.status}
                  </span>
                </div>
                <p className="text-xs text-[#64748b]">
                  {bot.strategy} • {bot.symbol} • {bot.totalTrades} trades
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
                  onClick={() => toggleBot(bot.id, bot.status)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    bot.status === "RUNNING"
                      ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                      : "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/20"
                  }`}
                >
                  {bot.status === "RUNNING" ? "Stop" : "Start"}
                </button>
                <button
                  onClick={() => deleteBot(bot.id)}
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
