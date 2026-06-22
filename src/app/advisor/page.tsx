"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, CheckCircle, XCircle,
  RefreshCw, Clock, Zap, BarChart3, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${barWidth}%`,
            background: positive ? "#00ff88" : "#ef4444",
            marginLeft: positive ? 0 : "auto",
          }}
        />
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
      {/* Header */}
      <div className="p-5" style={{ background: `linear-gradient(135deg, ${sideColor}08, transparent)` }}>
        <div className="flex items-start justify-between mb-3">
          <div>
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
                  reasoning.trendStrength > 35 ? "bg-[#7c3aed]/15 text-[#a78bfa] border-[#7c3aed]/25" :
                  reasoning.trendStrength > 20 ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20" :
                  "bg-white/5 text-[#64748b] border-white/5"
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

        {/* Confidence */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">AI Confidence</span>
            <span className="text-xs text-[#64748b]">{reasoning.fearGreedLabel} ({reasoning.fearGreedValue})</span>
          </div>
          <ConfidenceBar confidence={proposal.confidence} />
        </div>

        {/* Trade levels */}
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

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-[#64748b] mb-4">
          <span>RR: <span className="text-white font-semibold">{reasoning.riskRewardRatio}:1</span></span>
          <span>Size: <span className="text-white font-semibold">{reasoning.positionSizePct.toFixed(1)}% balance</span></span>
          <span>Qty: <span className="text-white font-semibold">{proposal.quantity.toFixed(4)}</span></span>
          <span className="text-[#00ff88]">+${profit.toFixed(2)} potential</span>
          <span className="text-red-400">-${risk.toFixed(2)} risk</span>
        </div>

        {/* Market condition */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-xs text-[#f59e0b] font-semibold">Market Condition</span>
          </div>
          <p className="text-xs text-[#94a3b8]">{reasoning.marketCondition}</p>
        </div>

        {/* Factor breakdown toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-[#64748b] hover:text-white transition-colors w-full"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {expanded ? "Hide" : "Show"} factor breakdown ({reasoning.factors.length} signals)
          {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>
      </div>

      {/* Expandable factors */}
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

      {/* Action buttons */}
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
          className="flex-2 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-black text-sm font-bold transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          style={{ background: sideColor }}
        >
          <CheckCircle className="w-4 h-4" />
          {loading === proposal.id + "_approve" ? "Executing..." : "Approve & Execute"}
        </button>
      </div>
    </motion.div>
  );
}

export default function AdvisorPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [mode, setMode] = useState<"PAPER" | "LIVE">("PAPER");

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
      showToast("Failed to load proposals — check your connection", false);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        showToast(`${data.generated} new ${data.generated === 1 ? "opportunity" : "opportunities"} found!`, true);
      } else {
        showToast("No high-confidence opportunities right now. Will check again in 30 minutes.", false);
      }
      await load();
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
        showToast("Trade executed successfully!", true);
        setProposals((prev) => prev.filter((p) => p.id !== id));
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
      showToast("Network error — could not deny", false);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh proposals every 5 minutes
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

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
            <h1 className="text-2xl font-black text-white">AI Advisor</h1>
          </div>
          <p className="text-[#64748b] text-sm">
            13 indicators across 1H + 4H + 1D timeframes. ATR-based stops, ADX trend filter, candlestick patterns. You just say yes or no.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setMode(mode === "PAPER" ? "LIVE" : "PAPER")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              mode === "PAPER"
                ? "border-[#06b6d4]/30 text-[#06b6d4] bg-[#06b6d4]/5"
                : "border-[#f59e0b]/30 text-[#f59e0b] bg-[#f59e0b]/5"
            }`}
          >
            {mode}
          </button>
          <button onClick={load} className="p-2 rounded-xl border border-white/8 text-[#64748b] hover:text-white transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-xs text-[#94a3b8]">Auto-scanning every 30 min</span>
          </div>
          <span className="text-[#1e2130]">|</span>
          <span className="text-xs text-[#64748b]">
            {proposals.length} pending proposal{proposals.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] text-white text-xs font-semibold rounded-xl hover:bg-[#6d28d9] transition-all disabled:opacity-60"
        >
          <Zap className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Analysing..." : "Scan Now"}
        </button>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: BarChart3, label: "13 Signals", desc: "RSI/MACD/BB/EMA across 1H+4H+1D, Stoch RSI, candlesticks, order book, sentiment", color: "#06b6d4" },
          { icon: Brain, label: "AI Scores", desc: "Weighted scoring with per-user learned accuracy", color: "#7c3aed" },
          { icon: TrendingUp, label: "Proposals", desc: "60%+ confidence threshold + multi-timeframe alignment required", color: "#00ff88" },
          { icon: Zap, label: "You Consent", desc: "One tap to execute — you're always in control", color: "#f59e0b" },
        ].map((item) => (
          <div key={item.label} className="p-3 rounded-xl border border-white/5 bg-white/[0.015] text-center">
            <item.icon className="w-4 h-4 mx-auto mb-2" style={{ color: item.color }} />
            <p className="text-xs font-bold text-white mb-1">{item.label}</p>
            <p className="text-[10px] text-[#64748b] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Proposals */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {proposals.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Brain className="w-12 h-12 text-[#1e2130] mb-4" />
              <p className="text-white font-semibold mb-1">No active proposals</p>
              <p className="text-[#64748b] text-sm max-w-xs">
                The AI is monitoring 8 pairs continuously. Click "Scan Now" to trigger an immediate analysis, or wait for the next 30-minute cycle.
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

    </div>
  );
}
