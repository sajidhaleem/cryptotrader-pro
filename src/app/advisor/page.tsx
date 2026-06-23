"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, CheckCircle, XCircle,
  RefreshCw, Clock, Zap, BarChart3, AlertTriangle, ChevronDown, ChevronUp,
  Trophy, Target, Activity, Sparkles, BookOpen, ArrowUpRight, ArrowDownRight
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Factor {
  indicator: string;
  signal: string;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
  rawValue: string | number;
}

interface Reasoning {
  recommendation: string;
  summary: string;
  marketCondition: string;
  fearGreedValue: number;
  fearGreedLabel: string;
  riskRewardRatio: number;
  positionSizePct: number;
  trendStrength?: number;
  multiTFAlignment?: boolean;
  atr?: number;
  factors: Factor[];
  analysedAt: string;
}

interface Proposal {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  mode: string;
  expiresAt: string;
  reasoning: Reasoning;
}

interface Performance {
  totalExecuted: number;
  totalResolved: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalPnl: number;
  avgConfidence: number | null;
  learningActive: boolean;
  signalAccuracy: { indicator: string; wins: number; losses: number; total: number; winRate: number }[];
  recentTrades: { symbol: string; side: string; outcome: string | null; pnl: number | null; closedAt: string | null }[];
}

interface QuickScan {
  symbol: string;
  price: number;
  signal: string;
  strength: number;
  trend: string;
  rsi: number;
}

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "DOGEUSDT", "AVAXUSDT"];

// ── Sub-components ─────────────────────────────────────────────────────────────
function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 75 ? "#00ff88" : confidence >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-sm font-bold" style={{ color }}>{confidence}%</span>
    </div>
  );
}

function FactorRow({ factor }: { factor: Factor }) {
  const positive = factor.contribution > 0;
  const barWidth = Math.min(100, Math.abs(factor.contribution) / 1.5);
  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#94a3b8]">{factor.indicator}</span>
          <span className={`text-xs font-bold ${positive ? "text-[#00ff88]" : factor.contribution < 0 ? "text-red-400" : "text-[#94a3b8]"}`}>
            {factor.signal}
          </span>
        </div>
        <span className="text-xs text-[#64748b]">w={factor.weight.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: positive ? "#00ff88" : "#ef4444" }} />
      </div>
      <p className="text-xs text-[#64748b] leading-relaxed">{factor.explanation}</p>
    </div>
  );
}

function ProposalCard({ proposal, onApprove, onDeny, loading }: {
  proposal: Proposal;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  loading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBuy = proposal.side === "BUY";
  const sideColor = isBuy ? "#00ff88" : "#ef4444";
  const expiresIn = Math.max(0, Math.round((new Date(proposal.expiresAt).getTime() - Date.now()) / 60000));
  const profit = Math.abs(proposal.takeProfit - proposal.entryPrice) * proposal.quantity;
  const risk = Math.abs(proposal.stopLoss - proposal.entryPrice) * proposal.quantity;
  const reasoning = proposal.reasoning;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${sideColor}25` }}
    >
      <div className="p-5" style={{ background: `linear-gradient(135deg, ${sideColor}08, transparent)` }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-lg font-black text-white">{proposal.symbol.replace("USDT", "/USDT")}</span>
              <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: `${sideColor}20`, color: sideColor }}>
                {isBuy ? "▲ BUY" : "▼ SELL"}
              </span>
              {reasoning.multiTFAlignment && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/25">
                  ✓ 3-TF ALIGNED
                </span>
              )}
              {reasoning.trendStrength != null && (
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                  reasoning.trendStrength > 35 ? "bg-[#7c3aed]/15 text-[#a78bfa] border-[#7c3aed]/25"
                  : reasoning.trendStrength > 20 ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20"
                  : "bg-white/5 text-[#64748b] border-white/5"
                }`}>
                  ADX {reasoning.trendStrength.toFixed(0)}
                </span>
              )}
              <span className="text-xs text-[#64748b]">{proposal.mode}</span>
            </div>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{reasoning.summary}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#64748b] flex-shrink-0 ml-4">
            <Clock className="w-3 h-3" />
            {expiresIn}m
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">AI Confidence</span>
            <span className="text-xs text-[#64748b]">{reasoning.fearGreedLabel} ({reasoning.fearGreedValue})</span>
          </div>
          <ConfidenceBar confidence={proposal.confidence} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Entry", value: `$${proposal.entryPrice.toFixed(2)}`, color: "text-white" },
            { label: "Stop Loss", value: `$${proposal.stopLoss.toFixed(2)}`, color: "text-red-400" },
            { label: "Take Profit", value: `$${proposal.takeProfit.toFixed(2)}`, color: "text-[#00ff88]" },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
              <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
              <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-[#64748b] mb-4 flex-wrap">
          <span>RR: <span className="text-white font-semibold">{reasoning.riskRewardRatio}:1</span></span>
          <span>Size: <span className="text-white font-semibold">{reasoning.positionSizePct.toFixed(1)}% balance</span></span>
          <span>Qty: <span className="text-white font-semibold">{proposal.quantity.toFixed(4)}</span></span>
          <span className="text-[#00ff88]">+${profit.toFixed(2)} target</span>
          <span className="text-red-400">-${risk.toFixed(2)} max risk</span>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-xs text-[#f59e0b] font-semibold">Market Condition</span>
          </div>
          <p className="text-xs text-[#94a3b8]">{reasoning.marketCondition}</p>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-[#64748b] hover:text-white transition-colors w-full"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {expanded ? "Hide" : "Show"} signal breakdown ({reasoning.factors.length} indicators)
          {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-3 border-t border-white/5">
              <p className="text-xs text-[#64748b] pt-3 mb-2 uppercase tracking-wider">Signal Breakdown</p>
              {reasoning.factors.map((f) => (
                <FactorRow key={f.indicator} factor={f} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={() => onDeny(proposal.id)}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-400/20 text-red-400 text-sm font-semibold hover:bg-red-400/5 transition-all disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          {loading === proposal.id + "_deny" ? "Denying..." : "Deny"}
        </button>
        <button
          onClick={() => onApprove(proposal.id)}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-black text-sm font-bold transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          style={{ background: sideColor }}
        >
          <CheckCircle className="w-4 h-4" />
          {loading === proposal.id + "_approve" ? "Executing..." : "Approve & Execute"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const mode = "LIVE";
  const [scanResults, setScanResults] = useState<QuickScan[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/proposals");
      const data = await r.json();
      setProposals(data.proposals ?? []);
    } catch {
      showToast("Failed to load proposals", false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPerf = useCallback(async () => {
    setPerfLoading(true);
    try {
      const r = await fetch("/api/performance");
      if (r.ok) setPerf(await r.json());
    } catch { /* silent */ } finally {
      setPerfLoading(false);
    }
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", mode }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error ?? "Analysis failed", false);
      } else if (data.generated > 0) {
        showToast(`${data.generated} new opportunity${data.generated > 1 ? "s" : ""} found!`, true);
      } else {
        showToast("No high-confidence setups right now. Market overview updated below.", false);
      }
      await Promise.all([load(), loadMarketScan()]);
    } catch {
      showToast("Scan failed — network error", false);
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    setActionLoading(id + "_approve");
    try {
      const r = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", proposalId: id }),
      });
      const data = await r.json();
      if (data.success) {
        showToast("Trade executed! Outcome will be tracked automatically.", true);
        setProposals((prev) => prev.filter((p) => p.id !== id));
        loadPerf();
      } else {
        showToast(data.error ?? "Failed to execute trade", false);
      }
    } catch {
      showToast("Network error — trade not executed", false);
    } finally {
      setActionLoading(null);
    }
  };

  const deny = async (id: string) => {
    setActionLoading(id + "_deny");
    try {
      await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny", proposalId: id }),
      });
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch {
      showToast("Network error", false);
    } finally {
      setActionLoading(null);
    }
  };

  const loadMarketScan = useCallback(async () => {
    setScanLoading(true);
    const results: QuickScan[] = [];
    for (const pair of PAIRS) {
      try {
        const res = await fetch(`/api/signals?symbol=${pair}&interval=4h`);
        if (!res.ok) continue;
        const d = await res.json();
        if (d?.signal) {
          results.push({
            symbol: pair,
            price: d.price,
            signal: d.signal.signal,
            strength: d.signal.strength,
            trend: d.signal.trend,
            rsi: d.signal.rsi,
          });
          setScanResults([...results].sort((a, b) => b.strength - a.strength));
        }
      } catch { /* skip */ }
    }
    setScanLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadPerf();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, loadPerf]);

  useEffect(() => { loadMarketScan(); }, [loadMarketScan]);

  // Derive AI market briefing from scan results
  const bullish = scanResults.filter(r => r.signal.includes("BUY")).length;
  const bearish = scanResults.filter(r => r.signal.includes("SELL")).length;
  const marketMood = scanResults.length === 0 ? null
    : bullish > bearish + 2 ? "bullish"
    : bearish > bullish + 2 ? "bearish"
    : "mixed";
  const topOpportunity = scanResults[0];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl ${
              toast.ok ? "bg-[#00ff88] text-black" : "bg-[#1e2130] text-white border border-white/10"
            }`}
          >
            {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#a78bfa]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">AI Financial Advisor</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-xs text-[#64748b]">
                  {perf?.learningActive ? `Learning from ${perf.totalResolved} resolved trades` : "Learning from your trades"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-xs font-semibold text-[#00ff88]">LIVE</span>
          </div>
          <button onClick={load} className="p-2 rounded-xl border border-white/8 text-[#64748b] hover:text-white transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* AI Market Briefing */}
      {marketMood && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex items-start gap-3 ${
            marketMood === "bullish" ? "border-[#00ff88]/20 bg-[#00ff88]/[0.03]"
            : marketMood === "bearish" ? "border-red-400/20 bg-red-400/[0.03]"
            : "border-[#f59e0b]/20 bg-[#f59e0b]/[0.03]"
          }`}
        >
          <Sparkles className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
            marketMood === "bullish" ? "text-[#00ff88]"
            : marketMood === "bearish" ? "text-red-400"
            : "text-[#f59e0b]"
          }`} />
          <div>
            <p className="text-sm font-semibold text-white mb-0.5">
              {marketMood === "bullish"
                ? `Market is leaning bullish — ${bullish}/${scanResults.length} pairs showing buy signals`
                : marketMood === "bearish"
                ? `Market is leaning bearish — ${bearish}/${scanResults.length} pairs showing sell signals`
                : `Mixed market — ${bullish} bullish, ${bearish} bearish, ${scanResults.length - bullish - bearish} neutral`
              }
            </p>
            {topOpportunity && (
              <p className="text-xs text-[#94a3b8]">
                Strongest signal: <span className="font-semibold text-white">{topOpportunity.symbol.replace("USDT", "")}</span> —{" "}
                {topOpportunity.signal.replace("_", " ")} at {topOpportunity.strength}% strength, RSI {topOpportunity.rsi.toFixed(0)}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Performance Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Win Rate",
            value: perfLoading ? "—" : perf?.winRate != null ? `${perf.winRate}%` : "No data",
            sub: perf?.totalResolved ? `${perf.wins}W / ${perf.losses}L` : "Execute trades to track",
            icon: Trophy,
            color: perf?.winRate != null && perf.winRate >= 60 ? "#00ff88" : perf?.winRate != null ? "#f59e0b" : "#64748b",
          },
          {
            label: "Total P&L",
            value: perfLoading ? "—" : perf?.totalPnl != null ? `${perf.totalPnl >= 0 ? "+" : ""}$${perf.totalPnl.toFixed(2)}` : "$0.00",
            sub: perf?.totalExecuted ? `from ${perf.totalExecuted} trades` : "No trades yet",
            icon: perf?.totalPnl != null && perf.totalPnl >= 0 ? TrendingUp : TrendingDown,
            color: perf?.totalPnl != null && perf.totalPnl >= 0 ? "#00ff88" : "#ef4444",
          },
          {
            label: "Avg Confidence",
            value: perfLoading ? "—" : perf?.avgConfidence != null ? `${perf.avgConfidence}%` : "—",
            sub: "of approved proposals",
            icon: Target,
            color: "#7c3aed",
          },
          {
            label: "AI Learning",
            value: perfLoading ? "—" : perf?.learningActive ? "Active" : "Warming up",
            sub: perf?.signalAccuracy?.length ? `${perf.signalAccuracy.length} indicators tracked` : "Needs more trades",
            icon: Activity,
            color: perf?.learningActive ? "#00ff88" : "#64748b",
          },
        ].map((item) => (
          <div key={item.label} className="p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#64748b] uppercase tracking-wider">{item.label}</span>
              <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
            </div>
            <p className="text-xl font-black text-white mb-0.5">{item.value}</p>
            <p className="text-xs text-[#64748b]">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Best indicators (shown once there's data) */}
      {perf?.signalAccuracy && perf.signalAccuracy.length > 0 && (
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="font-semibold text-white text-sm">Signal Intelligence — What&apos;s Working for You</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {perf.signalAccuracy.slice(0, 6).map((s) => (
              <div key={s.indicator} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div>
                  <p className="text-xs font-mono text-white font-semibold">{s.indicator}</p>
                  <p className="text-[10px] text-[#64748b]">{s.wins}W / {s.losses}L from {s.total} signals</p>
                </div>
                <span className={`text-sm font-bold ${s.winRate >= 60 ? "text-[#00ff88]" : s.winRate >= 45 ? "text-[#f59e0b]" : "text-red-400"}`}>
                  {s.winRate}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#475569] mt-3">
            The AI automatically increases weight on high-accuracy indicators for your next proposals.
          </p>
        </div>
      )}

      {/* Scan controls */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#94a3b8]">
            {proposals.length} pending proposal{proposals.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[#1e2130]">|</span>
          <span className="text-xs text-[#64748b]">Auto-scans every 30 min</span>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] text-white text-xs font-semibold rounded-xl hover:bg-[#6d28d9] transition-all disabled:opacity-60"
        >
          <Zap className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Analysing 6 pairs..." : "Scan Now"}
        </button>
      </div>

      {/* Proposals */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {proposals.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <Brain className="w-10 h-10 text-[#1e2130] mb-3" />
              <p className="text-white font-semibold mb-1">No active proposals</p>
              <p className="text-[#64748b] text-sm max-w-xs">
                No setup clears the 45%+ confidence bar right now. See the Market Overview below for live signals, or hit Scan Now to run a fresh analysis.
              </p>
            </motion.div>
          )}
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={approve}
              onDeny={deny}
              loading={actionLoading}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Market Overview */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2130]">
          <div>
            <h3 className="font-semibold text-white text-sm">Market Overview</h3>
            <p className="text-[#64748b] text-xs mt-0.5">Live 4H technical signals — ranked by strength</p>
          </div>
          <button
            onClick={loadMarketScan}
            disabled={scanLoading}
            className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${scanLoading ? "animate-spin" : ""}`} />
            {scanLoading ? "Scanning..." : "Refresh"}
          </button>
        </div>

        {scanLoading && scanResults.length === 0 ? (
          <div className="py-8 text-center text-[#64748b] text-sm">Fetching live signals for all pairs...</div>
        ) : (
          <div className="divide-y divide-[#1e2130]">
            {scanResults.map((r, idx) => {
              const isBuy = r.signal.includes("BUY");
              const isSell = r.signal.includes("SELL");
              const sigColor = isBuy ? "#00ff88" : isSell ? "#ef4444" : "#f59e0b";
              return (
                <div key={r.symbol} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-5 flex-shrink-0 text-xs text-[#475569] font-mono">{idx + 1}</div>
                  <div className="w-24 flex-shrink-0">
                    <p className="text-sm font-bold text-white">
                      {r.symbol.replace("USDT", "")}<span className="text-[#475569] font-normal">/USDT</span>
                    </p>
                    <p className="text-xs text-[#64748b]">${r.price.toLocaleString()}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: sigColor }}>{r.signal.replace("_", " ")}</span>
                      <span className="text-xs text-[#64748b]">RSI {r.rsi.toFixed(0)} · {r.trend}</span>
                    </div>
                    <div className="h-1.5 bg-[#1e2130] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.strength}%`, background: sigColor }} />
                    </div>
                  </div>
                  <div className="w-10 text-right flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-white">{r.strength}%</span>
                    {isBuy ? (
                      <ArrowUpRight className="w-3 h-3 text-[#00ff88]" />
                    ) : isSell ? (
                      <ArrowDownRight className="w-3 h-3 text-red-400" />
                    ) : null}
                  </div>
                </div>
              );
            })}
            {scanResults.length === 0 && !scanLoading && (
              <div className="py-8 text-center text-[#64748b] text-sm">Click Refresh to load live signals</div>
            )}
          </div>
        )}
      </div>

      {/* Recent trade history */}
      {perf?.recentTrades && perf.recentTrades.length > 0 && (
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e2130]">
            <h3 className="font-semibold text-white text-sm">Recent Trade Outcomes</h3>
            <p className="text-[#64748b] text-xs mt-0.5">AI-tracked results feeding back into learning weights</p>
          </div>
          <div className="divide-y divide-[#1e2130]">
            {perf.recentTrades.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.outcome === "WIN" ? "bg-[#00ff88]"
                    : t.outcome === "LOSS" ? "bg-red-400"
                    : t.outcome === "BREAKEVEN" ? "bg-[#f59e0b]"
                    : "bg-[#475569]"
                  }`} />
                  <div>
                    <p className="text-sm text-white font-semibold">{t.symbol.replace("USDT", "/USDT")}</p>
                    <p className="text-xs text-[#64748b]">{t.side} · {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "open"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    t.outcome === "WIN" ? "text-[#00ff88]"
                    : t.outcome === "LOSS" ? "text-red-400"
                    : t.outcome === "BREAKEVEN" ? "text-[#f59e0b]"
                    : "text-[#475569]"
                  }`}>
                    {t.outcome ?? "Pending"}
                  </p>
                  {t.pnl != null && (
                    <p className="text-xs text-[#64748b]">{t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-[#1a1f2e] text-xs text-[#475569] text-center">
        ⚠️ AI analysis is based on technical indicators and market sentiment — not financial advice. Always apply your own judgement before executing any trade.
      </div>
    </div>
  );
}
