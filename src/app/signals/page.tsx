"use client";

import { useEffect, useState, useCallback } from "react";

const PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT", "XRPUSDT", "AVAXUSDT"];
const INTERVALS = ["1h", "4h", "1d"];

interface SignalData {
  symbol: string;
  interval: string;
  price: number;
  volume: number;
  signal: {
    signal: string;
    strength: number;
    rsi: number;
    macd: { value: number; signal: number; histogram: number } | null;
    bb: { upper: number; middle: number; lower: number } | null;
    ema20: number;
    ema50: number;
    trend: string;
    summary: string;
    indicators: { name: string; value: string; signal: string }[];
  };
}

const SIGNAL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  STRONG_BUY: { text: "text-[#00ff88]", bg: "bg-[#00ff88]/10", border: "border-[#00ff88]/40" },
  BUY: { text: "text-[#22c55e]", bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/30" },
  HOLD: { text: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  SELL: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  STRONG_SELL: { text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
};

const IND_COLORS: Record<string, string> = {
  BUY: "text-[#00ff88]",
  SELL: "text-red-400",
  NEUTRAL: "text-[#64748b]",
};

export default function SignalsPage() {
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [interval, setInterval] = useState("4h");
  const [data, setData] = useState<SignalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [multiSignals, setMultiSignals] = useState<Record<string, SignalData>>({});
  const [loadingAll, setLoadingAll] = useState(false);

  const fetchSignal = useCallback(async (pair: string, iv: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/signals?symbol=${pair}&interval=${iv}`);
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignal(selectedPair, interval); }, [selectedPair, interval, fetchSignal]);

  async function loadAllSignals() {
    setLoadingAll(true);
    const results: Record<string, SignalData> = {};
    await Promise.all(
      PAIRS.map(async (pair) => {
        try {
          const res = await fetch(`/api/signals?symbol=${pair}&interval=4h`);
          const d = await res.json();
          results[pair] = d;
        } catch { /* skip */ }
      })
    );
    setMultiSignals(results);
    setLoadingAll(false);
  }

  useEffect(() => { loadAllSignals(); }, []);

  const colors = data ? (SIGNAL_COLORS[data.signal.signal] ?? SIGNAL_COLORS.HOLD) : SIGNAL_COLORS.HOLD;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Trading Signals</h1>
          <p className="text-[#64748b] text-sm mt-1">Technical analysis powered by RSI, MACD, Bollinger Bands & EMAs</p>
        </div>
        <button onClick={loadAllSignals} disabled={loadingAll}
          className="px-4 py-2 border border-[#1e2130] text-[#64748b] hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50">
          {loadingAll ? "Refreshing..." : "🔄 Refresh All"}
        </button>
      </div>

      {/* Market overview grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PAIRS.map((pair) => {
          const s = multiSignals[pair];
          const sig = s?.signal.signal ?? "—";
          const c = SIGNAL_COLORS[sig] ?? { text: "text-[#64748b]", bg: "bg-[#1a1f2e]", border: "border-[#1e2130]" };
          return (
            <button
              key={pair}
              onClick={() => setSelectedPair(pair)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedPair === pair ? "border-[#00ff88]/50 bg-[#00ff88]/5" : `${c.border} ${c.bg} hover:border-[#00ff88]/30`
              }`}
            >
              <p className="font-bold text-white text-sm">{pair.replace("USDT", "")}<span className="text-[#475569]">/USDT</span></p>
              {s ? (
                <>
                  <p className={`text-xs font-bold mt-1 ${c.text}`}>{sig.replace("_", " ")}</p>
                  <div className="mt-2 h-1 bg-[#1e2130] rounded-full">
                    <div className={`h-full rounded-full transition-all`} style={{ width: `${s.signal.strength}%`, backgroundColor: sig.includes("BUY") ? "#00ff88" : sig.includes("SELL") ? "#ef4444" : "#f59e0b" }} />
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">{s.signal.strength}% strength</p>
                </>
              ) : (
                <p className="text-xs text-[#475569] mt-1">Loading...</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detailed analysis */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main signal */}
        <div className={`lg:col-span-1 rounded-2xl border p-6 ${colors.border} ${colors.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-lg">{selectedPair}</h2>
            <div className="flex gap-2">
              {INTERVALS.map((iv) => (
                <button key={iv} onClick={() => setInterval(iv)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${interval === iv ? "bg-white/10 text-white" : "text-[#64748b] hover:text-white"}`}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-[#64748b]">Analyzing...</div>
          ) : data ? (
            <>
              <div className="text-center py-4">
                <div className={`text-4xl font-black mb-2 ${colors.text}`}>
                  {data.signal.signal.replace("_", " ")}
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${data.price.toLocaleString()}
                </div>
                <div className="relative w-full h-3 bg-[#1e2130] rounded-full my-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${data.signal.strength}%`,
                      backgroundColor: data.signal.signal.includes("BUY") ? "#00ff88" : data.signal.signal.includes("SELL") ? "#ef4444" : "#f59e0b",
                    }}
                  />
                </div>
                <p className="text-sm text-[#94a3b8]">{data.signal.summary}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "RSI (14)", value: data.signal.rsi.toFixed(1), color: data.signal.rsi < 30 ? "text-[#00ff88]" : data.signal.rsi > 70 ? "text-red-400" : "text-white" },
                  { label: "Trend", value: data.signal.trend, color: data.signal.trend === "BULLISH" ? "text-[#00ff88]" : data.signal.trend === "BEARISH" ? "text-red-400" : "text-yellow-400" },
                  { label: "EMA 20", value: `$${data.signal.ema20.toLocaleString()}`, color: "text-white" },
                  { label: "EMA 50", value: `$${data.signal.ema50.toLocaleString()}`, color: "text-white" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-black/20">
                    <p className="text-xs text-[#64748b]">{item.label}</p>
                    <p className={`font-bold text-sm mt-0.5 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* Indicator breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {data && (
            <>
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4">Indicator Breakdown</h3>
                <div className="space-y-3">
                  {data.signal.indicators.map((ind) => (
                    <div key={ind.name} className="flex items-center gap-4">
                      <div className="w-32 text-sm text-[#94a3b8]">{ind.name}</div>
                      <div className="flex-1 text-sm text-white font-mono">{ind.value}</div>
                      <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        ind.signal === "BUY" ? "bg-[#00ff88]/10 text-[#00ff88]" :
                        ind.signal === "SELL" ? "bg-red-400/10 text-red-400" :
                        "bg-[#1a1f2e] text-[#64748b]"
                      }`}>
                        {ind.signal}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {data.signal.macd && (
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">MACD Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "MACD Line", value: data.signal.macd.value.toFixed(4), color: data.signal.macd.value > 0 ? "text-[#00ff88]" : "text-red-400" },
                      { label: "Signal Line", value: data.signal.macd.signal.toFixed(4), color: "text-white" },
                      { label: "Histogram", value: data.signal.macd.histogram.toFixed(4), color: data.signal.macd.histogram > 0 ? "text-[#00ff88]" : "text-red-400" },
                    ].map((item) => (
                      <div key={item.label} className="p-3 bg-[#1a1f2e] rounded-xl">
                        <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
                        <p className={`font-bold text-sm font-mono ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.signal.bb && (
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">Bollinger Bands</h3>
                  <div className="relative">
                    <div className="flex justify-between text-xs text-[#64748b] mb-2">
                      <span>Lower: ${data.signal.bb.lower.toLocaleString()}</span>
                      <span>Middle: ${data.signal.bb.middle.toLocaleString()}</span>
                      <span>Upper: ${data.signal.bb.upper.toLocaleString()}</span>
                    </div>
                    <div className="h-6 bg-[#1a1f2e] rounded-full relative overflow-hidden">
                      <div className="absolute inset-y-0 left-[20%] right-[20%] bg-[#7c3aed]/20 rounded-full" />
                      {(() => {
                        const range = data.signal.bb.upper - data.signal.bb.lower;
                        const pos = ((data.price - data.signal.bb.lower) / range) * 100;
                        return (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00ff88] rounded-full border-2 border-white"
                            style={{ left: `${Math.max(2, Math.min(98, pos))}%` }}
                          />
                        );
                      })()}
                    </div>
                    <p className="text-xs text-center text-[#64748b] mt-2">Price position within Bollinger Bands</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-[#1a1f2e] text-xs text-[#475569] text-center">
        ⚠️ Signals are based on technical analysis only. Not financial advice. Always do your own research before trading.
      </div>
    </div>
  );
}
