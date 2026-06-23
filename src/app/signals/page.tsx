"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CRYPTO_ASSETS, COMMODITY_ASSETS, FOREX_ASSETS, type AssetCategory } from "@/lib/market-signals-types";

interface SignalData {
  symbol: string;
  category: AssetCategory;
  price: number;
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

type AssetDef = { symbol: string; label: string; short: string; unit?: string };

const TABS: { id: AssetCategory; label: string; emoji: string; assets: AssetDef[] }[] = [
  { id: "crypto",    label: "Crypto",      emoji: "₿", assets: CRYPTO_ASSETS    },
  { id: "commodity", label: "Commodities", emoji: "🏅", assets: COMMODITY_ASSETS },
  { id: "forex",     label: "Forex",       emoji: "💱", assets: FOREX_ASSETS     },
];

const SIG_STYLE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  STRONG_BUY:  { text: "text-[#00ff88]",  bg: "bg-[#00ff88]/10",  border: "border-[#00ff88]/40",  dot: "bg-[#00ff88]"  },
  BUY:         { text: "text-[#22c55e]",  bg: "bg-[#22c55e]/10",  border: "border-[#22c55e]/30",  dot: "bg-[#22c55e]"  },
  HOLD:        { text: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30", dot: "bg-yellow-400" },
  SELL:        { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30", dot: "bg-orange-400" },
  STRONG_SELL: { text: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    dot: "bg-red-400"    },
};

const NEUTRAL_STYLE = { text: "text-[#64748b]", bg: "bg-[#1a1f2e]", border: "border-[#1e2130]", dot: "bg-[#475569]" };

function barColor(sig: string) {
  if (sig.includes("BUY"))  return "#00ff88";
  if (sig.includes("SELL")) return "#ef4444";
  return "#f59e0b";
}

function fmtPrice(price: number, category: AssetCategory) {
  if (category === "forex") return price.toFixed(4);
  if (price > 100) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

export default function SignalsPage() {
  const [activeTab, setActiveTab]         = useState<AssetCategory>("crypto");
  const [signals, setSignals]             = useState<Record<string, SignalData>>({});
  const [loading, setLoading]             = useState<Record<string, boolean>>({});
  const [selected, setSelected]           = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const fetchedTabs                       = useRef<Set<AssetCategory>>(new Set());

  const fetchAssets = useCallback(async (category: AssetCategory, assets: AssetDef[]) => {
    setRefreshing(true);
    for (const asset of assets) {
      setLoading((p) => ({ ...p, [asset.symbol]: true }));
      try {
        const res = await fetch(`/api/market-signals?symbol=${encodeURIComponent(asset.symbol)}&category=${category}&interval=1d`);
        if (!res.ok) continue;
        const d = await res.json();
        if (d?.signal) setSignals((p) => ({ ...p, [asset.symbol]: d }));
      } catch { /* skip */ } finally {
        setLoading((p) => ({ ...p, [asset.symbol]: false }));
      }
      // Stagger requests to avoid rate limits
      await new Promise((r) => setTimeout(r, 300));
    }
    setRefreshing(false);
  }, []);

  // Load tab data on first visit
  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    if (!fetchedTabs.current.has(activeTab)) {
      fetchedTabs.current.add(activeTab);
      fetchAssets(activeTab, tab.assets);
      // Auto-select first asset
      if (!selected) setSelected(tab.assets[0].symbol);
    }
  }, [activeTab, fetchAssets, selected]);

  function handleRefresh() {
    const tab = TABS.find((t) => t.id === activeTab)!;
    fetchedTabs.current.delete(activeTab);
    fetchedTabs.current.add(activeTab);
    fetchAssets(activeTab, tab.assets);
  }

  const currentTab   = TABS.find((t) => t.id === activeTab)!;
  const selectedData = selected ? signals[selected] : null;
  const selectedAsset = currentTab.assets.find((a) => a.symbol === selected);
  const detailStyle  = selectedData ? (SIG_STYLE[selectedData.signal.signal] ?? NEUTRAL_STYLE) : NEUTRAL_STYLE;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Signals</h1>
          <p className="text-[#64748b] text-sm mt-1">
            Buy / Sell signals for crypto, commodities &amp; currencies — powered by RSI, MACD, BB &amp; EMA
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-[#1e2130] text-[#64748b] hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin inline-block" : ""}>↻</span>
          {refreshing ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-1 bg-[#0f1117] border border-[#1e2130] rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelected(tab.assets[0].symbol); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#00ff88] text-black"
                : "text-[#64748b] hover:text-white"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Asset grid (left panel) */}
        <div className="lg:col-span-1 space-y-2">
          {currentTab.assets.map((asset) => {
            const d    = signals[asset.symbol];
            const isLd = loading[asset.symbol];
            const sig  = d?.signal?.signal ?? "";
            const c    = sig ? (SIG_STYLE[sig] ?? NEUTRAL_STYLE) : NEUTRAL_STYLE;
            const isActive = selected === asset.symbol;

            return (
              <button
                key={asset.symbol}
                onClick={() => setSelected(asset.symbol)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? "border-[#00ff88]/50 bg-[#00ff88]/5"
                    : `${c.border} bg-[#0f1117] hover:border-[#00ff88]/30`
                }`}
              >
                {/* Coin avatar */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black ${c.bg} border ${c.border}`}>
                  <span className={c.text}>{asset.short.slice(0, 3)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-semibold truncate">{asset.label}</span>
                    {isLd ? (
                      <span className="text-[#475569] text-xs">…</span>
                    ) : sig ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                        {sig.replace("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  {d ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#64748b] text-xs">{fmtPrice(d.price, activeTab)}</span>
                      <div className="flex-1 h-1 bg-[#1e2130] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${d.signal.strength}%`, backgroundColor: barColor(sig) }}
                        />
                      </div>
                      <span className="text-[#475569] text-xs">{d.signal.strength}%</span>
                    </div>
                  ) : (
                    <div className="h-1 mt-2 bg-[#1e2130] rounded-full animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel (right) */}
        <div className="lg:col-span-2 space-y-4">

          {!selectedData ? (
            <div className="rounded-2xl border border-[#1e2130] bg-[#0f1117] p-8 text-center text-[#475569]">
              Select an asset to see detailed analysis
            </div>
          ) : (
            <>
              {/* Signal card */}
              <div className={`rounded-2xl border p-6 ${detailStyle.border} ${detailStyle.bg}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedAsset?.label}</h2>
                    <p className="text-[#64748b] text-sm">{selectedAsset?.symbol} · {activeTab}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${detailStyle.text}`}>
                      {selectedData.signal.signal.replace("_", " ")}
                    </div>
                    <div className="text-xl font-bold text-white mt-0.5">
                      {fmtPrice(selectedData.price, activeTab)}
                    </div>
                  </div>
                </div>

                {/* Strength bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                    <span>Signal Strength</span>
                    <span>{selectedData.signal.strength}%</span>
                  </div>
                  <div className="h-2.5 bg-[#1e2130] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${selectedData.signal.strength}%`, backgroundColor: barColor(selectedData.signal.signal) }}
                    />
                  </div>
                </div>

                <p className="text-sm text-[#94a3b8]">{selectedData.signal.summary}</p>

                {/* Key stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "RSI (14)", value: selectedData.signal.rsi.toFixed(1),
                      color: selectedData.signal.rsi < 30 ? "text-[#00ff88]" : selectedData.signal.rsi > 70 ? "text-red-400" : "text-white" },
                    { label: "Trend", value: selectedData.signal.trend,
                      color: selectedData.signal.trend === "BULLISH" ? "text-[#00ff88]" : selectedData.signal.trend === "BEARISH" ? "text-red-400" : "text-yellow-400" },
                    { label: "EMA 20", value: fmtPrice(selectedData.signal.ema20, activeTab), color: "text-white" },
                    { label: "EMA 50", value: fmtPrice(selectedData.signal.ema50, activeTab), color: "text-white" },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-xl bg-black/20">
                      <p className="text-xs text-[#64748b]">{item.label}</p>
                      <p className={`font-bold text-sm mt-0.5 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indicator breakdown */}
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4">Indicator Breakdown</h3>
                <div className="space-y-2.5">
                  {selectedData.signal.indicators.map((ind) => (
                    <div key={ind.name} className="flex items-center gap-4">
                      <div className="w-36 text-sm text-[#94a3b8] flex-shrink-0">{ind.name}</div>
                      <div className="flex-1 text-sm text-white font-mono">{ind.value}</div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        ind.signal === "BUY"  ? "bg-[#00ff88]/10 text-[#00ff88]" :
                        ind.signal === "SELL" ? "bg-red-400/10 text-red-400"     :
                        "bg-[#1a1f2e] text-[#64748b]"
                      }`}>
                        {ind.signal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MACD */}
              {selectedData.signal.macd && (
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">MACD</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "MACD Line",  value: selectedData.signal.macd.value.toFixed(5),     color: selectedData.signal.macd.value > 0 ? "text-[#00ff88]" : "text-red-400" },
                      { label: "Signal Line",value: selectedData.signal.macd.signal.toFixed(5),    color: "text-white" },
                      { label: "Histogram",  value: selectedData.signal.macd.histogram.toFixed(5), color: selectedData.signal.macd.histogram > 0 ? "text-[#00ff88]" : "text-red-400" },
                    ].map((item) => (
                      <div key={item.label} className="p-3 bg-[#1a1f2e] rounded-xl">
                        <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
                        <p className={`font-bold text-sm font-mono ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bollinger Bands */}
              {selectedData.signal.bb && (
                <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">Bollinger Bands</h3>
                  <div className="flex justify-between text-xs text-[#64748b] mb-2">
                    <span>Lower: {fmtPrice(selectedData.signal.bb.lower, activeTab)}</span>
                    <span>Middle: {fmtPrice(selectedData.signal.bb.middle, activeTab)}</span>
                    <span>Upper: {fmtPrice(selectedData.signal.bb.upper, activeTab)}</span>
                  </div>
                  <div className="h-6 bg-[#1a1f2e] rounded-full relative overflow-hidden">
                    <div className="absolute inset-y-0 left-[20%] right-[20%] bg-[#7c3aed]/20 rounded-full" />
                    {(() => {
                      const range = selectedData.signal.bb.upper - selectedData.signal.bb.lower;
                      const pos = range > 0 ? ((selectedData.price - selectedData.signal.bb.lower) / range) * 100 : 50;
                      return (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00ff88] rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,255,136,0.6)]"
                          style={{ left: `${Math.max(2, Math.min(98, pos))}%` }}
                        />
                      );
                    })()}
                  </div>
                  <p className="text-xs text-center text-[#64748b] mt-2">Price position within Bollinger Bands</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-[#475569] text-center pb-2">
        ⚠️ Signals are based on technical analysis only and are not financial advice. Always do your own research.
      </p>
    </div>
  );
}
