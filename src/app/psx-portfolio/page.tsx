"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, RefreshCw, TrendingUp, TrendingDown, Plus, Trash2,
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
      className="overflow-hidden rounded-xl border border-amber-500/20 bg-[#0f1117] p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Symbol</label>
          <input
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="EFERT"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Company</label>
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Engro Fertilizers"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Quantity</label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1000"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Avg buy rate</label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={avgBuyRate}
            onChange={(e) => setAvgBuyRate(e.target.value)}
            placeholder="44.22"
            className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Form</label>
          <div className="flex gap-2">
            {(["Physical", "CDC"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForm(f)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition-all ${
                  form === f
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                    : "bg-[#1a1f2e] text-[#64748b] border-[#1e2130] hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-amber-500 text-black text-sm font-bold py-2 hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save holding"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-[#64748b] hover:text-white border border-[#1e2130]"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function PsxPortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/60 mb-0.5">
            Karachi Stock Exchange
          </p>
          <h1 className="text-[22px] font-black text-white tracking-tight leading-none">
            My Holdings
          </h1>
          <p className="text-[11px] text-[#64748b] mt-1">
            Personal PSX portfolio · marked to live prices
          </p>
        </div>
        <button
          onClick={fetchHoldings}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1f2e] border border-[#1e2130] text-[#64748b] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Loading…" : "Refresh"}
        </button>
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
                <span className="text-[11px] font-bold text-amber-400/80 tracking-wide">TOTAL PORTFOLIO VALUE</span>
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
                <p className="text-[9px] text-[#475569] uppercase tracking-wider font-semibold">Cost basis</p>
                <p className="text-xs font-bold text-white mt-0.5">{rs(totals.costBasis)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#475569] uppercase tracking-wider font-semibold">Securities</p>
                <p className="text-xs font-bold text-white mt-0.5">{data?.holdings.length ?? 0}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#475569] uppercase tracking-wider font-semibold">Total shares</p>
                <p className="text-xs font-bold text-white mt-0.5">{totals.shares.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* ── Add holding ── */}
      <AnimatePresence mode="wait">
        {showAddForm ? (
          <AddHoldingForm
            onAdded={() => {
              setShowAddForm(false);
              fetchHoldings();
            }}
            onClose={() => setShowAddForm(false)}
          />
        ) : (
          <motion.button
            key="add-button"
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#1e2130] py-3 text-sm font-semibold text-[#64748b] hover:text-amber-400 hover:border-amber-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add a holding
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Holdings list ── */}
      {!loading && data && data.holdings.length === 0 && !showAddForm && (
        <div className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-8 text-center">
          <p className="text-sm text-[#64748b]">No holdings yet. Add your first PSX position above.</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.holdings.map((h, idx) => {
          const up = h.change1d >= 0;
          const plPositive = h.unrealizedPL >= 0;
          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-xl border border-[#1e2130] bg-[#0f1117] p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-white">{h.symbol}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1f2e] text-[#64748b]">{h.form}</span>
                  {h.priceSource === "unavailable" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">last known</span>
                  )}
                </div>
                <p className="text-[11px] text-[#64748b] truncate mt-0.5">{h.company}</p>
                <p className="text-[10px] text-[#475569] mt-1">
                  {h.quantity.toLocaleString()} shares at {rs(h.avgBuyRate)}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-white tabular-nums">{rs(h.marketValue)}</p>
                <p className={`text-[11px] font-bold mt-0.5 ${plPositive ? "text-[#00ff88]" : "text-red-400"}`}>
                  {plPositive ? "+" : ""}
                  {rs(h.unrealizedPL)} ({h.unrealizedPLPct.toFixed(1)}%)
                </p>
                {h.priceSource === "live" && (
                  <p className={`text-[10px] mt-0.5 ${up ? "text-[#00ff88]/70" : "text-red-400/70"}`}>
                    {rs(h.price)} ({up ? "+" : ""}{h.change1d.toFixed(1)}% today)
                  </p>
                )}
              </div>

              <button
                onClick={() => handleDelete(h.id)}
                className="flex-shrink-0 p-2 rounded-lg text-[#475569] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                aria-label={`Remove ${h.symbol}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
