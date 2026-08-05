"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, RefreshCw, TrendingUp, TrendingDown, Settings, X, Trash2,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────── */

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

/* ─── Format helpers ────────────────────────────────────────────── */

function rs(n: number): string {
  return `₨${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Validated categorical palette (dataviz skill, dark mode, slots 1-5), fixed order, never cycled by rank
const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];

/* ─── Allocation chart ──────────────────────────────────────────── */

function AllocationBar({ holdings, totalValue }: { holdings: PricedHolding[]; totalValue: number }) {
  if (holdings.length === 0 || totalValue <= 0) return null;

  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#0f1117] p-5">
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Allocation by holding</p>

      <div className="flex h-3 rounded-full overflow-hidden gap-px" role="img" aria-label="Portfolio allocation by holding">
        {holdings.map((h, i) => {
          const pct = (h.marketValue / totalValue) * 100;
          return (
            <div
              key={h.id}
              style={{ width: `${Math.max(pct, 0.5)}%`, background: PALETTE[i % PALETTE.length] }}
              title={`${h.symbol}: ${pct.toFixed(1)}% (${rs(h.marketValue)})`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2.5 mt-4">
        {holdings.map((h, i) => {
          const pct = (h.marketValue / totalValue) * 100;
          return (
            <div key={h.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }}
                aria-hidden
              />
              <span className="text-xs font-bold text-white">{h.symbol}</span>
              <span className="text-xs text-[#94a3b8]">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Add holding form ──────────────────────────────────────────── */

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
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save holding");
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

/* ─── Holding tile ──────────────────────────────────────────────── */

function HoldingTile({
  holding,
  color,
  index,
  onDelete,
}: {
  holding: PricedHolding;
  color: string;
  index: number;
  onDelete: (id: string) => void;
}) {
  const up = holding.change1d >= 0;
  const plPositive = holding.unrealizedPL >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-4 hover:border-white/15 transition-colors"
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} aria-hidden />
          <p className="text-sm font-black text-white truncate">{holding.symbol}</p>
        </div>
        <button
          onClick={() => onDelete(holding.id)}
          aria-label={`Remove ${holding.symbol}`}
          className="flex-shrink-0 p-1 rounded-md text-[#475569] hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-[#94a3b8] truncate mb-3">{holding.company}</p>

      <p className="text-lg font-black text-white tabular-nums">{rs(holding.marketValue)}</p>
      <p className={`text-xs font-bold mt-1 ${plPositive ? "text-[#00ff88]" : "text-red-400"}`}>
        {plPositive ? "+" : ""}
        {rs(holding.unrealizedPL)} ({holding.unrealizedPLPct.toFixed(1)}%)
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <span className="text-[11px] text-[#94a3b8]">
          {holding.quantity.toLocaleString()} @ {rs(holding.avgBuyRate)}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1f2e] text-[#94a3b8]">{holding.form}</span>
      </div>

      {holding.priceSource === "live" ? (
        <p className={`text-[11px] mt-1.5 ${up ? "text-[#00ff88]" : "text-red-400"}`}>
          {rs(holding.price)} ({up ? "+" : ""}
          {holding.change1d.toFixed(1)}% today)
        </p>
      ) : (
        <p className="text-[11px] mt-1.5 text-amber-400">last known price</p>
      )}
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function PsxPortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHoldings = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/psx-holdings");
      if (!res.ok) throw new Error("Failed to load portfolio");
      const json: PortfolioResponse = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Couldn't load your portfolio. Try refreshing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  async function handleDelete(id: string) {
    await fetch(`/api/psx-holdings?id=${id}`, { method: "DELETE" });
    fetchHoldings();
  }

  const totals = data?.totals;
  const plUp = (totals?.unrealizedPL ?? 0) >= 0;
  const hasUnavailable = data?.holdings.some((h) => h.priceSource === "unavailable") ?? false;

  return (
    <div className="min-h-full px-4 py-6 max-w-5xl mx-auto space-y-5 pb-24 md:pb-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500/70 mb-0.5">
            Karachi Stock Exchange
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">
            My Holdings
          </h1>
          <p className="text-[13px] text-[#94a3b8] mt-1.5">
            Personal PSX portfolio, marked to live prices
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchHoldings}
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

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {hasUnavailable && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          Couldn&apos;t reach live prices for one or more holdings. Showing your average buy rate as a fallback for those.
        </div>
      )}

      {/* ── Portfolio hero card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#100d00] via-[#0f1117] to-[#0f1117]">
        <div className="relative z-10 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-xs font-bold text-amber-400 tracking-wide">TOTAL PORTFOLIO VALUE</span>
              </div>

              {loading ? (
                <div className="space-y-2">
                  <div className="h-9 w-48 rounded-lg bg-[#1a1f2e]/60 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-[#1a1f2e]/60 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-4xl font-black text-white tabular-nums tracking-tight leading-none">
                    {rs(totals?.marketValue ?? 0)}
                  </p>
                  <div
                    className={`flex items-center gap-1.5 mt-1.5 text-sm font-bold ${
                      plUp ? "text-[#00ff88]" : "text-red-400"
                    }`}
                  >
                    {plUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {plUp ? "+" : ""}
                    {rs(totals?.unrealizedPL ?? 0)} ({(totals?.unrealizedPLPct ?? 0).toFixed(1)}%)
                  </div>
                </>
              )}
            </div>
          </div>

          {!loading && totals && (
            <div className="flex gap-6 mt-4 pt-3.5 border-t border-white/5">
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">Cost basis</p>
                <p className="text-sm font-bold text-white mt-0.5">{rs(totals.costBasis)}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">Securities</p>
                <p className="text-sm font-bold text-white mt-0.5">{data?.holdings.length ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">Total shares</p>
                <p className="text-sm font-bold text-white mt-0.5">{totals.shares.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* ── Allocation chart ── */}
      {!loading && data && data.holdings.length > 0 && (
        <AllocationBar holdings={data.holdings} totalValue={totals?.marketValue ?? 0} />
      )}

      {/* ── Manage holdings panel (opened via the settings icon) ── */}
      <AnimatePresence>
        {showSettings && (
          <AddHoldingForm
            onAdded={() => {
              setShowSettings(false);
              fetchHoldings();
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Holdings tiles ── */}
      {!loading && data && data.holdings.length === 0 && !showSettings && (
        <div className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-8 text-center">
          <p className="text-sm text-[#94a3b8]">
            No holdings yet. Tap the settings icon above to add your first PSX position.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.holdings.map((h, idx) => (
          <HoldingTile
            key={h.id}
            holding={h}
            color={PALETTE[idx % PALETTE.length]}
            index={idx}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
