"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, RefreshCw, Landmark, Zap,
  Building2, Sprout, Activity, Cpu, Pill, Shirt,
  Info, Settings, X, Trash2, ChevronDown,
} from "lucide-react";
import {
  PSX_ASSETS,
  PSX_SECTORS,
  SECTOR_COLORS,
  type PSXSector,
} from "@/lib/psx-types";
import type { PricePoint } from "@/lib/psx-price";

/* ─── Types ─────────────────────────────────────────────────────── */

interface PSXSignalResponse {
  symbol: string;
  label: string;
  sector: PSXSector;
  price: number;
  change1d: number;
  history: PricePoint[];
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

interface PricedHolding {
  id: string;
  symbol: string;
  company: string;
  quantity: number;
  avgBuyRate: number;
  form: string;
  price: number;
  change1d: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  priceSource: "live" | "unavailable";
}

interface PortfolioResponse {
  holdings: PricedHolding[];
  totals: {
    marketValue: number;
    costBasis: number;
    unrealizedPL: number;
    unrealizedPLPct: number;
    shares: number;
  };
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

function rs(n: number): string {
  return `₨${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function rsCompact(n: number): string {
  return `₨${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/* ─── Small shared vizzes ───────────────────────────────────────── */

// Animated count-up for a headline number
function AnimatedNumber({ value, format: fmt }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const dur = 700;
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

  return <>{fmt(display)}</>;
}

function MiniArea({ id, data, color }: { id: string; data: { v: number }[]; color: string }) {
  if (data.length < 2) {
    return <div className="h-full w-full flex items-center justify-center text-[9px] text-[#334155]">No data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ data, color }: { data: { v: number }[]; color: string }) {
  if (data.length < 2) {
    return <div className="h-full w-full flex items-center justify-center text-[9px] text-[#334155]">No data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutMini({ pct, color }: { pct: number; color: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1a1f2e" strokeWidth="4" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
        />
      </svg>
    </div>
  );
}

/* ─── KPI stat tile ─────────────────────────────────────────────── */

function StatTile({
  label, value, sub, delta, deltaLabel = "today", viz,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: number;
  deltaLabel?: string;
  viz: React.ReactNode;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#0f1117] p-4 flex flex-col">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#64748b]">{label}</p>
      <p className="text-xl font-black text-white tabular-nums mt-1.5 leading-none truncate">{value}</p>
      {sub && <p className="text-[11px] text-[#94a3b8] mt-1 truncate">{sub}</p>}
      <div className="mt-3 h-10">{viz}</div>
      {delta !== undefined && (
        <p className={`text-[11px] font-bold mt-2 flex items-center gap-1 ${positive ? "text-[#00ff88]" : "text-red-400"}`}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {positive ? "+" : ""}{delta.toFixed(1)}% {deltaLabel}
        </p>
      )}
    </div>
  );
}

/* ─── Price trend chart ─────────────────────────────────────────── */

function TrendTooltip({ active, payload, avgBuyRate }: {
  active?: boolean;
  payload?: { payload: { dateLabel: string; close: number; chg: number } }[];
  avgBuyRate?: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const positive = p.chg >= 0;
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#0f1117] px-3.5 py-3 shadow-xl">
      <p className="text-[10px] text-[#64748b] font-semibold mb-1">{p.dateLabel}</p>
      <p className="text-lg font-black text-white tabular-nums">₨{p.close.toFixed(2)}</p>
      <p className={`text-[11px] font-bold mt-0.5 ${positive ? "text-[#00ff88]" : "text-red-400"}`}>
        {positive ? "+" : ""}{p.chg.toFixed(2)}% vs prior session
      </p>
      {avgBuyRate != null && (
        <p className="text-[10px] text-[#94a3b8] mt-1.5 pt-1.5 border-t border-white/5">
          {p.close >= avgBuyRate ? "Above" : "Below"} your avg buy of ₨{avgBuyRate.toFixed(2)}
        </p>
      )}
    </div>
  );
}

function PriceTrendChart({
  tabs, active, onTabChange, history, avgBuyRate, loading,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onTabChange: (k: string) => void;
  history: PricePoint[];
  avgBuyRate?: number;
  loading: boolean;
}) {
  const chartData = useMemo(() => {
    return history.map((pt, i) => {
      const prevPt = history[i - 1];
      const chg = prevPt ? ((pt.close - prevPt.close) / prevPt.close) * 100 : 0;
      return { close: pt.close, chg, dateLabel: format(new Date(pt.time * 1000), "MMM d") };
    });
  }, [history]);

  const high = chartData.length ? Math.max(...chartData.map((d) => d.close)) : 0;
  const low = chartData.length ? Math.min(...chartData.map((d) => d.close)) : 0;
  const activeLabel = tabs.find((t) => t.key === active)?.label ?? active;

  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#0f1117] p-5">
      <div className="flex items-start justify-between mb-1 gap-3">
        <p className="text-sm font-bold text-white">Price Trends</p>
        {chartData.length > 1 && (
          <span className="text-[10px] text-[#64748b] font-semibold whitespace-nowrap">
            High ₨{high.toFixed(2)} · Low ₨{low.toFixed(2)}
          </span>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
              active === t.key
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "text-[#64748b] border-transparent hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-60 rounded-lg bg-[#1a1f2e]/40 animate-pulse" />
      ) : chartData.length < 2 ? (
        <div className="h-60 flex items-center justify-center text-sm text-[#475569]">
          No chart data available for {activeLabel} yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e2130" vertical={false} />
            <XAxis dataKey="dateLabel" tick={{ fill: "#475569", fontSize: 10 }} axisLine={{ stroke: "#1e2130" }} tickLine={false} minTickGap={40} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={(v: number) => `₨${Math.round(v)}`}
            />
            <Tooltip content={<TrendTooltip avgBuyRate={avgBuyRate} />} />
            {avgBuyRate != null && (
              <ReferenceLine
                y={avgBuyRate}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Avg buy", position: "insideTopLeft", fill: "#94a3b8", fontSize: 10 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b", stroke: "#0f1117", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex items-center gap-5 mt-2 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-[#64748b] font-semibold">{activeLabel} price</span>
        </div>
        {avgBuyRate != null && (
          <div className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[#94a3b8]" />
            <span className="text-[10px] text-[#64748b] font-semibold">Your avg buy rate</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Add / edit holding form ───────────────────────────────────── */

function AddHoldingForm({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [company, setCompany] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgBuyRate, setAvgBuyRate] = useState("");
  const [form, setForm] = useState<"Physical" | "CDC">("Physical");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/psx-holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        company,
        quantity: parseFloat(quantity),
        avgBuyRate: parseFloat(avgBuyRate),
        form,
      }),
    });

    if (!res.ok) {
      const dataRes = await res.json().catch(() => ({}));
      setError(dataRes.error ?? "Failed to save holding");
      setSaving(false);
      return;
    }

    onAdded();
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0f1117] p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Add or update a holding</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Symbol</label>
          <input
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="EFERT"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Company</label>
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Engro Fertilizers"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Quantity</label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1000"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Avg buy rate</label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={avgBuyRate}
            onChange={(e) => setAvgBuyRate(e.target.value)}
            placeholder="44.22"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">Form</label>
          <div className="flex gap-2">
            {(["Physical", "CDC"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForm(f)}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold border transition-all ${
                  form === f
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                    : "bg-[#1a1f2e] text-[#94a3b8] border-[#1e2130] hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-amber-500 text-black text-sm font-bold py-2.5 hover:bg-amber-400 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save holding"}
      </button>
    </motion.form>
  );
}

/* ─── Holdings table ─────────────────────────────────────────────── */

function HoldingsTable({
  holdings, totalValue, onDelete,
}: {
  holdings: PricedHolding[];
  totalValue: number;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (holdings.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#0f1117] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm font-bold text-white">Holdings</p>
        <span className="text-[11px] text-[#64748b]">{holdings.length} securities</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-t border-b border-[#1e2130] text-[10px] uppercase tracking-wider text-[#64748b]">
              <th className="text-left font-semibold px-5 py-2.5">Security</th>
              <th className="text-right font-semibold px-3 py-2.5">Value (₨)</th>
              <th className="text-right font-semibold px-3 py-2.5">Weight</th>
              <th className="text-right font-semibold px-3 py-2.5">Unrealized P&amp;L</th>
              <th className="text-right font-semibold px-3 py-2.5 hidden sm:table-cell">Avg Buy</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const pct = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
              const plUp = h.unrealizedPL >= 0;
              const up = h.change1d >= 0;
              const expanded = expandedId === h.id;
              return (
                <Fragment key={h.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : h.id)}
                    className="border-b border-[#1e2130] cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-black text-amber-400">{h.symbol.slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{h.symbol}</p>
                          <p className="text-[11px] text-[#94a3b8] truncate max-w-[140px]">{h.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-bold text-white tabular-nums">{rs(h.marketValue)}</p>
                      {h.priceSource === "live" ? (
                        <p className={`text-[10px] ${up ? "text-[#00ff88]" : "text-red-400"}`}>
                          {up ? "+" : ""}{h.change1d.toFixed(1)}% today
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-400">last known price</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-bold text-white tabular-nums">{pct.toFixed(1)}%</p>
                      <div className="w-16 h-1 rounded-full bg-[#1a1f2e] mt-1 ml-auto overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className={`font-bold tabular-nums ${plUp ? "text-[#00ff88]" : "text-red-400"}`}>
                        {plUp ? "+" : ""}{rs(h.unrealizedPL)}
                      </p>
                      <p className={`text-[10px] ${plUp ? "text-[#00ff88]" : "text-red-400"}`}>
                        {plUp ? "+" : ""}{h.unrealizedPLPct.toFixed(1)}%
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right text-[#94a3b8] tabular-nums hidden sm:table-cell">{rs(h.avgBuyRate)}</td>
                    <td className="px-3">
                      <ChevronDown className={`w-4 h-4 text-[#475569] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="px-5 bg-white/[0.015]">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-[12px] text-[#94a3b8]">
                              <span>
                                {h.quantity.toLocaleString()} shares ({h.form}) · Cost basis {rs(h.costBasis)}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(h.id); }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 border border-red-400/20 text-[11px] font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */

export default function PSXPage() {
  // Market signals (20-stock scan + KSE-100 index)
  const [signals, setSignals] = useState<Record<string, PSXSignalResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [kse100, setKse100] = useState<PSXSignalResponse | null>(null);
  const [kseLoading, setKseLoading] = useState(true);
  const [activeSector, setActiveSector] = useState<PSXSector | "All">("All");
  const [refreshingSignals, setRefreshingSignals] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  // Holdings (personal portfolio)
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Trend chart tab selection
  const [activeTrendTab, setActiveTrendTab] = useState<string>("KSE100");
  const trendDefaultSet = useRef(false);

  const fetchSignals = useCallback(async () => {
    setRefreshingSignals(true);

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

    const initLoading: Record<string, boolean> = {};
    PSX_ASSETS.forEach((a) => { initLoading[a.symbol] = true; });
    setLoading((p) => ({ ...p, ...initLoading }));

    const BATCH = 4;
    for (let i = 0; i < PSX_ASSETS.length; i += BATCH) {
      const batch = PSX_ASSETS.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (asset) => {
          try {
            const res = await fetch(`/api/psx-signals?symbol=${encodeURIComponent(asset.symbol)}`);
            if (!res.ok) return;
            const d: PSXSignalResponse = await res.json();
            if (d?.signal) setSignals((p) => ({ ...p, [asset.symbol]: d }));
          } catch { /* skip */ } finally {
            setLoading((p) => ({ ...p, [asset.symbol]: false }));
          }
        })
      );
      if (i + BATCH < PSX_ASSETS.length) await new Promise((r) => setTimeout(r, 1200));
    }
    setRefreshingSignals(false);
  }, []);

  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const res = await fetch("/api/psx-holdings");
      if (!res.ok) throw new Error("Failed to load portfolio");
      const json: PortfolioResponse = await res.json();
      setData(json);
      setHoldingsError(null);
    } catch {
      setHoldingsError("Couldn't load your portfolio. Try refreshing.");
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchSignals();
      fetchHoldings();
    }
  }, [fetchSignals, fetchHoldings]);

  // Default the trend-chart tab to the first holding, once holdings arrive
  useEffect(() => {
    if (!trendDefaultSet.current && data?.holdings.length) {
      trendDefaultSet.current = true;
      setActiveTrendTab(data.holdings[0].symbol);
    }
  }, [data]);

  // Fetch price history for every held symbol not covered by the 20-stock scan
  // (e.g. a custom holding outside PSX_ASSETS) — needed for both its trend-chart
  // tab and the weighted portfolio-value sparkline, which requires every holding.
  useEffect(() => {
    if (!data || data.holdings.length === 0) return;
    const missing = data.holdings
      .map((h) => `${h.symbol}.KA`)
      .filter((key) => !signals[key] && !loading[key]);
    if (missing.length === 0) return;
    missing.forEach((key, i) => {
      setLoading((p) => ({ ...p, [key]: true }));
      setTimeout(() => {
        fetch(`/api/psx-signals?symbol=${encodeURIComponent(key)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((d: PSXSignalResponse | null) => { if (d?.history) setSignals((p) => ({ ...p, [key]: d })); })
          .catch(() => {})
          .finally(() => setLoading((p) => ({ ...p, [key]: false })));
      }, i * 400);
    });
  }, [data, signals, loading]);

  async function handleDelete(id: string) {
    await fetch(`/api/psx-holdings?id=${id}`, { method: "DELETE" });
    fetchHoldings();
  }

  function refreshAll() {
    fetchSignals();
    fetchHoldings();
  }

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

  // Sector groups to display
  const sectorGroups =
    activeSector === "All"
      ? PSX_SECTORS.map((s) => ({ sector: s, assets: PSX_ASSETS.filter((a) => a.sector === s) }))
      : [{ sector: activeSector, assets: PSX_ASSETS.filter((a) => a.sector === activeSector) }];

  // ── Portfolio KPI derivations ──
  const totals = data?.totals;
  const totalValue = totals?.marketValue ?? 0;
  const plUp = (totals?.unrealizedPL ?? 0) >= 0;
  const hasUnavailable = data?.holdings.some((h) => h.priceSource === "unavailable") ?? false;

  const weightedDayChange =
    data && totalValue > 0
      ? data.holdings.reduce((sum, h) => sum + h.change1d * (h.marketValue / totalValue), 0)
      : 0;

  const topHolding = data && data.holdings.length > 0
    ? data.holdings.slice().sort((a, b) => b.marketValue - a.marketValue)[0]
    : null;
  const topPct = topHolding && totalValue > 0 ? (topHolding.marketValue / totalValue) * 100 : 0;

  // Weighted portfolio value series — real per-holding closes, trailing-index aligned
  // Weighted from whichever holdings have real history loaded — some symbols
  // (e.g. off-registry or unlisted tickers) may never resolve via Yahoo Finance,
  // so this degrades to a partial-coverage trend rather than waiting forever.
  const portfolioSeries = useMemo(() => {
    if (!data || data.holdings.length === 0) return [];
    const priced = data.holdings
      .map((h) => ({ holding: h, history: signals[`${h.symbol}.KA`]?.history }))
      .filter((p): p is { holding: PricedHolding; history: PricePoint[] } => !!p.history && p.history.length > 1);
    if (priced.length === 0) return [];
    const minLen = Math.min(...priced.map((p) => p.history.length));
    const trimmed = priced.map((p) => ({ holding: p.holding, history: p.history.slice(-minLen) }));
    const points: { v: number }[] = [];
    for (let i = 0; i < minLen; i++) {
      let total = 0;
      trimmed.forEach(({ holding, history }) => { total += holding.quantity * history[i].close; });
      points.push({ v: total });
    }
    return points;
  }, [data, signals]);

  const kseBarData = (kse100?.history ?? []).slice(-10).map((h) => ({ v: h.close }));

  const trendTabs = [
    { key: "KSE100", label: "KSE-100" },
    ...(data?.holdings.map((h) => ({ key: h.symbol, label: h.symbol })) ?? []),
  ];
  const activeHistory =
    activeTrendTab === "KSE100"
      ? kse100?.history ?? []
      : signals[`${activeTrendTab}.KA`]?.history ?? [];
  const activeAvgBuyRate =
    activeTrendTab === "KSE100" ? undefined : data?.holdings.find((h) => h.symbol === activeTrendTab)?.avgBuyRate;
  const trendLoading =
    activeTrendTab === "KSE100" ? kseLoading : (loading[`${activeTrendTab}.KA`] ?? false) && activeHistory.length === 0;

  const refreshing = refreshingSignals || holdingsLoading;

  return (
    <div className="min-h-full px-4 py-6 max-w-6xl mx-auto space-y-5 pb-24 md:pb-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/60 mb-0.5">
            Karachi Stock Exchange
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">
            PSX Portfolio
          </h1>
          <p className="text-[13px] text-[#94a3b8] mt-1.5">
            Real-time KSE-100 tracking and portfolio analytics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refreshAll}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1f2e] border border-[#1e2130] text-[#94a3b8] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Loading…" : "Refresh"}</span>
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Manage holdings"
            aria-pressed={showSettings}
            className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
              showSettings
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : "bg-[#1a1f2e] border-[#1e2130] text-[#94a3b8] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5"
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {holdingsError && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {holdingsError}
        </div>
      )}
      {hasUnavailable && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          Couldn&apos;t reach live prices for one or more holdings. Showing your average buy rate as a fallback for those.
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Portfolio Value"
          value={holdingsLoading ? "…" : <AnimatedNumber value={totalValue} format={rsCompact} />}
          sub="PKR Total"
          delta={data && data.holdings.length > 0 ? weightedDayChange : undefined}
          viz={<MiniArea id="grad-portfolio" data={portfolioSeries} color="#f59e0b" />}
        />
        <StatTile
          label="Top Holding"
          value={topHolding ? `${topPct.toFixed(1)}%` : "—"}
          sub={topHolding ? `${topHolding.symbol} · ${data?.holdings.length} securities` : "No holdings yet"}
          viz={topHolding ? (
            <div className="flex items-center gap-2.5 h-full">
              <DonutMini pct={topPct} color="#f59e0b" />
              <span className="text-[10px] text-[#64748b]">of portfolio value</span>
            </div>
          ) : <div className="h-full" />}
        />
        <StatTile
          label="Unrealized P&L"
          value={holdingsLoading ? "…" : rsCompact(totals?.unrealizedPL ?? 0)}
          sub="Open Positions"
          delta={data && data.holdings.length > 0 ? (totals?.unrealizedPLPct ?? 0) : undefined}
          viz={<MiniArea id="grad-pnl" data={portfolioSeries} color={plUp ? "#00ff88" : "#f87171"} />}
        />
        <StatTile
          label="KSE-100 Index"
          value={kseLoading ? "…" : kse100 ? <AnimatedNumber value={kse100.price} format={(v) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 })} /> : "—"}
          sub="Today's Level"
          delta={kse100 ? kse100.change1d : undefined}
          viz={<MiniBars data={kseBarData} color={kseUp ? "#00ff88" : "#f87171"} />}
        />
      </div>

      {/* ── Price trend chart ── */}
      <PriceTrendChart
        tabs={trendTabs}
        active={activeTrendTab}
        onTabChange={setActiveTrendTab}
        history={activeHistory}
        avgBuyRate={activeAvgBuyRate}
        loading={trendLoading}
      />

      {/* ── Manage holdings panel (opened via the settings icon) ── */}
      <AnimatePresence>
        {showSettings && (
          <AddHoldingForm
            onAdded={() => { setShowSettings(false); fetchHoldings(); }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Holdings table ── */}
      {!holdingsLoading && data && data.holdings.length === 0 && !showSettings && (
        <div className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-8 text-center">
          <p className="text-sm text-[#94a3b8]">
            No holdings yet. Tap the settings icon above to add your first PSX position.
          </p>
        </div>
      )}
      {data && (
        <HoldingsTable holdings={data.holdings} totalValue={totalValue} onDelete={handleDelete} />
      )}

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

      {/* ── Market Signals ── */}
      <div>
        <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Market Signals · 20 blue-chip stocks</p>

        {/* Sector filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none mb-4">
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

        {sectorGroups.map(({ sector, assets }, gi) => {
          const SectorIcon = SECTOR_ICONS[sector];
          const secColor = SECTOR_COLORS[sector];

          return (
            <motion.section
              key={sector}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.06 }}
              className="mb-5"
            >
              <div className={`flex items-center gap-2 mb-3 ${secColor.text}`}>
                <SectorIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">{sector}</span>
                <div className="flex-1 h-px opacity-30 bg-current" />
                <span className="text-[9px] text-[#475569]">
                  {assets.filter((a) => signals[a.symbol]).length}/{assets.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {assets.map((asset, idx) => {
                  const d = signals[asset.symbol];
                  const isLoading = loading[asset.symbol] ?? false;
                  const isExpanded = expanded === asset.symbol;
                  const sig = d?.signal?.signal ?? "";
                  const sty = sigStyle(sig);
                  const up = (d?.change1d ?? 0) >= 0;

                  if (isLoading && !d) {
                    return (
                      <div key={asset.symbol} className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-3.5 space-y-2.5">
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

                  return (
                    <motion.button
                      key={asset.symbol}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.035 + gi * 0.04, duration: 0.25 }}
                      onClick={() => setExpanded(isExpanded ? null : asset.symbol)}
                      className={`text-left rounded-xl border bg-[#0f1117] p-3.5 transition-all cursor-pointer group w-full ${
                        isExpanded
                          ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                          : d
                            ? "border-[#1e2130] hover:border-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)]"
                            : "border-[#1e2130] opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-[12px] font-black text-white tracking-tight">{asset.short}</p>
                          <p className="text-[9px] text-[#475569] leading-tight mt-0.5 truncate">{asset.label}</p>
                        </div>
                        {d && (
                          <span className={`text-[10px] font-bold flex-shrink-0 ${up ? "text-[#00ff88]" : "text-red-400"}`}>
                            {up ? "▲" : "▼"} {Math.abs(d.change1d).toFixed(1)}%
                          </span>
                        )}
                      </div>

                      {d ? (
                        <>
                          <p className="text-[17px] font-black text-white tabular-nums mb-2 leading-none">
                            ₨{d.price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>

                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${sty.bg} ${sty.border} ${sty.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sty.dot}`} />
                            {sty.label}
                          </div>

                          <div className="mt-2.5 space-y-1">
                            <div className="flex justify-between text-[8px] text-[#475569]">
                              <span>RSI {d.signal.rsi.toFixed(0)}</span>
                              <span>{d.signal.strength}%</span>
                            </div>
                            <div className="h-1 bg-[#1a1f2e] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${d.signal.strength}%` }}
                                transition={{ duration: 0.7, delay: idx * 0.03 + 0.1 }}
                                className="h-full rounded-full"
                                style={{ background: sty.bar }}
                              />
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-2"
                              >
                                <p className="text-[10px] text-[#64748b] leading-relaxed">{d.signal.summary}</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {d.signal.indicators.slice(0, 4).map((ind) => (
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
      </div>

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
