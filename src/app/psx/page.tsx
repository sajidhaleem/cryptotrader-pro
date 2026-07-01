"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RefreshCw, Landmark, Zap,
  Building2, Sprout, Activity, Cpu, Pill, Shirt, BarChart3,
  Info,
} from "lucide-react";
import {
  PSX_ASSETS,
  PSX_SECTORS,
  SECTOR_COLORS,
  type PSXSector,
} from "@/lib/psx-types";

/* ─── Types ─────────────────────────────────────────────────────── */

interface PSXSignalResponse {
  symbol: string;
  label: string;
  sector: PSXSector;
  price: number;
  change1d: number;
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
  timestamp: number;
}

/* ─── Constants ──────────────────────────────────────────────────── */

const SIG = {
  STRONG_BUY:  { text: "text-[#00ff88]",  bg: "bg-[#00ff88]/10",  border: "border-[#00ff88]/40",  dot: "bg-[#00ff88]",  label: "Strong Buy",  bar: "#00ff88" },
  BUY:         { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30", dot: "bg-emerald-400", label: "Buy",        bar: "#34d399" },
  HOLD:        { text: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30",  dot: "bg-amber-400",  label: "Hold",        bar: "#f59e0b" },
  SELL:        { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30", dot: "bg-orange-400", label: "Sell",        bar: "#fb923c" },
  STRONG_SELL: { text: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    dot: "bg-red-400",    label: "Strong Sell", bar: "#f87171" },
} as const;

const NEUTRAL_SIG = {
  text: "text-[#64748b]", bg: "bg-[#1a1f2e]", border: "border-[#1e2130]",
  dot: "bg-[#475569]", label: "—", bar: "#475569",
};

const SECTOR_ICONS: Record<PSXSector, React.FC<{ className?: string }>> = {
  Banking:    Landmark,
  Energy:     Zap,
  Cement:     Building2,
  Fertilizer: Sprout,
  Power:      Activity,
  Technology: Cpu,
  Pharma:     Pill,
  Textile:    Shirt,
};

function sigStyle(sig: string) {
  return SIG[sig as keyof typeof SIG] ?? NEUTRAL_SIG;
}

/* ─── Sub-components ─────────────────────────────────────────────── */

// Animated sine wave — the "market pulse" signature visual
function MarketPulse({ bullish }: { bullish: boolean }) {
  const color = bullish ? "#f59e0b" : "#64748b";
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      viewBox="0 0 400 80"
    >
      {/* Gradient fill below wave */}
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40 L400,80 L0,80 Z"
        fill="url(#waveGrad)"
        animate={{
          d: [
            "M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40 L400,80 L0,80 Z",
            "M0,40 C40,65 80,15 120,40 C160,65 200,15 240,40 C280,65 320,15 360,40 C380,52 390,46 400,40 L400,80 L0,80 Z",
            "M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40 L400,80 L0,80 Z",
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.path
        d="M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        animate={{
          d: [
            "M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40",
            "M0,40 C40,65 80,15 120,40 C160,65 200,15 240,40 C280,65 320,15 360,40 C380,52 390,46 400,40",
            "M0,40 C40,15 80,65 120,40 C160,15 200,65 240,40 C280,15 320,65 360,40 C380,28 390,34 400,40",
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

// Animated count-up for the KSE-100 price
function AnimatedPrice({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const dur = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  useEffect(() => { setDisplay(value); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{display.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</>;
}

// Stock card skeleton
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-3.5 space-y-2.5">
      <div className="flex justify-between">
        <div>
          <div className="h-3.5 w-14 rounded bg-[#1a1f2e] animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-[#1a1f2e] animate-pulse mt-1.5" />
        </div>
        <div className="h-3 w-10 rounded bg-[#1a1f2e] animate-pulse" />
      </div>
      <div className="h-6 w-24 rounded bg-[#1a1f2e] animate-pulse" />
      <div className="h-5 w-16 rounded-full bg-[#1a1f2e] animate-pulse" />
      <div className="h-1.5 w-full rounded-full bg-[#1a1f2e] animate-pulse" />
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */

export default function PSXPage() {
  const [signals, setSignals] = useState<Record<string, PSXSignalResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [kse100, setKse100] = useState<PSXSignalResponse | null>(null);
  const [kseLoading, setKseLoading] = useState(true);
  const [activeSector, setActiveSector] = useState<PSXSector | "All">("All");
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);

    // KSE-100 index
    setKseLoading(true);
    try {
      const res = await fetch("/api/psx-signals?symbol=%5EKSE100");
      if (res.ok) {
        const d = await res.json();
        if (d?.price) setKse100(d);
      }
    } catch { /* silent */ } finally {
      setKseLoading(false);
    }

    // Individual stocks — mark all loading
    const initLoading: Record<string, boolean> = {};
    PSX_ASSETS.forEach(a => { initLoading[a.symbol] = true; });
    setLoading(initLoading);

    // Batch of 4 with 1.2s gap (Yahoo Finance free tier)
    const BATCH = 4;
    for (let i = 0; i < PSX_ASSETS.length; i += BATCH) {
      const batch = PSX_ASSETS.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (asset) => {
          try {
            const res = await fetch(`/api/psx-signals?symbol=${encodeURIComponent(asset.symbol)}`);
            if (!res.ok) return;
            const d: PSXSignalResponse = await res.json();
            if (d?.signal) setSignals(p => ({ ...p, [asset.symbol]: d }));
          } catch { /* skip */ } finally {
            setLoading(p => ({ ...p, [asset.symbol]: false }));
          }
        })
      );
      if (i + BATCH < PSX_ASSETS.length) await new Promise(r => setTimeout(r, 1200));
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  // Breadth counts
  const loaded = Object.values(signals);
  const breadth = loaded.reduce(
    (acc, d) => {
      const s = d.signal?.signal ?? "";
      if (s.includes("BUY")) acc.buy++;
      else if (s.includes("SELL")) acc.sell++;
      else acc.hold++;
      return acc;
    },
    { buy: 0, hold: 0, sell: 0 }
  );

  const kseUp = (kse100?.change1d ?? 0) >= 0;
  const kseS = sigStyle(kse100?.signal?.signal ?? "");

  // Sector groups to display
  const sectorGroups =
    activeSector === "All"
      ? PSX_SECTORS.map(s => ({ sector: s, assets: PSX_ASSETS.filter(a => a.sector === s) }))
      : [{ sector: activeSector, assets: PSX_ASSETS.filter(a => a.sector === activeSector) }];

  return (
    <div className="min-h-full px-4 py-6 max-w-5xl mx-auto space-y-5 pb-24 md:pb-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/60 mb-0.5">
            Karachi Stock Exchange
          </p>
          <h1 className="text-[22px] font-black text-white tracking-tight leading-none">
            PSX Market
          </h1>
          <p className="text-[11px] text-[#64748b] mt-1">
            Technical signals · 20 blue-chip stocks
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1f2e] border border-[#1e2130] text-[#64748b] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── KSE-100 Hero card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#100d00] via-[#0f1117] to-[#0f1117]">
        <MarketPulse bullish={kseUp} />
        <div className="relative z-10 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-400/80 tracking-wide">KSE-100 INDEX</span>
                </div>
              </div>

              {kseLoading ? (
                <div className="space-y-2">
                  <div className="h-9 w-48 rounded-lg bg-[#1a1f2e]/60 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-[#1a1f2e]/60 animate-pulse" />
                </div>
              ) : kse100 ? (
                <>
                  <p className="text-4xl font-black text-white tabular-nums tracking-tight leading-none">
                    <AnimatedPrice value={kse100.price} />
                  </p>
                  <div
                    className={`flex items-center gap-1.5 mt-1.5 text-sm font-bold ${
                      kseUp ? "text-[#00ff88]" : "text-red-400"
                    }`}
                  >
                    {kseUp
                      ? <TrendingUp className="w-4 h-4" />
                      : <TrendingDown className="w-4 h-4" />}
                    {kseUp ? "+" : ""}
                    {kse100.change1d.toFixed(2)}% today
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#64748b]">Data unavailable</p>
              )}
            </div>

            {/* Signal + strength */}
            <div className="flex flex-col items-end gap-3">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${kseS.bg} ${kseS.border} ${kseS.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${kseS.dot}`} />
                {kseS.label}
              </div>
              {kse100?.signal?.strength && (
                <div className="text-right space-y-1">
                  <p className="text-[9px] font-semibold text-[#64748b] uppercase tracking-wider">
                    Signal Strength
                  </p>
                  <div className="w-28 h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${kse100.signal.strength}%` }}
                      transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                      className="h-full rounded-full bg-amber-500"
                    />
                  </div>
                  <p className="text-[9px] text-amber-500/70">{kse100.signal.strength}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Indicators mini row */}
          {kse100?.signal && (
            <div className="flex gap-4 mt-4 pt-3.5 border-t border-white/5">
              {[
                { label: "RSI", value: kse100.signal.rsi.toFixed(0) },
                { label: "Trend", value: kse100.signal.trend },
                { label: "EMA20", value: `₨${kse100.signal.ema20.toFixed(0)}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[9px] text-[#475569] uppercase tracking-wider font-semibold">{label}</p>
                  <p className="text-xs font-bold text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gold accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* ── Market breadth ── */}
      <AnimatePresence>
        {loaded.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2.5"
          >
            {([
              { label: "Buy Signals",  n: breadth.buy,  color: "text-[#00ff88]",  bg: "bg-[#00ff88]/5  border-[#00ff88]/15"  },
              { label: "Hold",         n: breadth.hold, color: "text-amber-400",  bg: "bg-amber-400/5  border-amber-400/15"  },
              { label: "Sell Signals", n: breadth.sell, color: "text-red-400",    bg: "bg-red-400/5    border-red-400/15"    },
            ] as const).map(({ label, n, color, bg }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                <motion.p
                  key={n}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-2xl font-black tabular-nums ${color}`}
                >
                  {n}
                </motion.p>
                <p className="text-[9px] text-[#64748b] font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sector filter ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {(["All", ...PSX_SECTORS] as (PSXSector | "All")[]).map((s) => {
          const active = activeSector === s;
          const col = s !== "All" ? SECTOR_COLORS[s] : null;
          return (
            <button
              key={s}
              onClick={() => setActiveSector(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                active
                  ? s === "All"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : `${col?.bg ?? ""} ${col?.text ?? ""} ${col?.border ?? ""}`
                  : "bg-[#1a1f2e] text-[#64748b] border-[#1e2130] hover:text-white hover:border-white/20"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* ── Stock grids by sector ── */}
      {sectorGroups.map(({ sector, assets }, gi) => {
        const SectorIcon = SECTOR_ICONS[sector];
        const secColor = SECTOR_COLORS[sector];

        return (
          <motion.section
            key={sector}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
          >
            {/* Sector heading */}
            <div className={`flex items-center gap-2 mb-3 ${secColor.text}`}>
              <SectorIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">{sector}</span>
              <div className="flex-1 h-px opacity-30 bg-current" />
              <span className="text-[9px] text-[#475569]">
                {assets.filter(a => signals[a.symbol]).length}/{assets.length}
              </span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {assets.map((asset, idx) => {
                const data = signals[asset.symbol];
                const isLoading = loading[asset.symbol] ?? false;
                const isExpanded = expanded === asset.symbol;
                const sig = data?.signal?.signal ?? "";
                const sty = sigStyle(sig);
                const up = (data?.change1d ?? 0) >= 0;

                if (isLoading || (!data && isLoading !== false)) {
                  return <CardSkeleton key={asset.symbol} />;
                }

                return (
                  <motion.button
                    key={asset.symbol}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.035 + gi * 0.04, duration: 0.25 }}
                    onClick={() => setExpanded(isExpanded ? null : asset.symbol)}
                    className={`text-left rounded-xl border bg-[#0f1117] p-3.5 transition-all cursor-pointer group w-full ${
                      isExpanded
                        ? `border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]`
                        : data
                          ? `border-[#1e2130] hover:border-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)]`
                          : `border-[#1e2130] opacity-60`
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <p className="text-[12px] font-black text-white tracking-tight">{asset.short}</p>
                        <p className="text-[9px] text-[#475569] leading-tight mt-0.5 truncate">{asset.label}</p>
                      </div>
                      {data && (
                        <span
                          className={`text-[10px] font-bold flex-shrink-0 ${
                            up ? "text-[#00ff88]" : "text-red-400"
                          }`}
                        >
                          {up ? "▲" : "▼"} {Math.abs(data.change1d).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {data ? (
                      <>
                        {/* Price */}
                        <p className="text-[17px] font-black text-white tabular-nums mb-2 leading-none">
                          ₨{data.price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>

                        {/* Signal badge */}
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${sty.bg} ${sty.border} ${sty.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sty.dot}`} />
                          {sty.label}
                        </div>

                        {/* Strength bar */}
                        <div className="mt-2.5 space-y-1">
                          <div className="flex justify-between text-[8px] text-[#475569]">
                            <span>RSI {data.signal.rsi.toFixed(0)}</span>
                            <span>{data.signal.strength}%</span>
                          </div>
                          <div className="h-1 bg-[#1a1f2e] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${data.signal.strength}%` }}
                              transition={{ duration: 0.7, delay: idx * 0.03 + 0.1 }}
                              className="h-full rounded-full"
                              style={{ background: sty.bar }}
                            />
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-2"
                            >
                              <p className="text-[10px] text-[#64748b] leading-relaxed">{data.signal.summary}</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {data.signal.indicators.slice(0, 4).map(ind => (
                                  <div key={ind.name} className="bg-[#1a1f2e] rounded-lg px-2 py-1.5">
                                    <p className="text-[8px] text-[#475569] uppercase tracking-wider">{ind.name}</p>
                                    <p className={`text-[10px] font-bold mt-0.5 ${
                                      ind.signal === "bullish" ? "text-[#00ff88]" :
                                      ind.signal === "bearish" ? "text-red-400" : "text-amber-400"
                                    }`}>{ind.value}</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <p className="text-[10px] text-[#475569] mt-1">No data</p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        );
      })}

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#1a1f2e]/50 border border-[#1e2130]">
        <Info className="w-3.5 h-3.5 text-[#475569] mt-0.5 flex-shrink-0" />
        <p className="text-[9px] text-[#475569] leading-relaxed">
          Data sourced from Yahoo Finance. Technical signals (RSI, MACD, Bollinger Bands, EMA) are computed from 6-month
          daily closes. For informational purposes only — not financial advice. Always conduct your own due diligence.
        </p>
      </div>
    </div>
  );
}
