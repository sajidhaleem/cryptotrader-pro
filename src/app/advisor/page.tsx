"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, CheckCircle, XCircle,
  RefreshCw, Clock, Zap, BarChart3, AlertTriangle, ChevronDown, ChevronUp,
  Trophy, Target, Activity, Sparkles, BookOpen, ArrowUpRight, ArrowDownRight,
  Star, Eye, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { CRYPTO_ASSETS, COMMODITY_ASSETS, FOREX_ASSETS } from "@/lib/market-signals-types";

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
  label: string;
  price: number;
  signal: string;
  strength: number;
  trend: string;
  rsi: number;
  category: "crypto" | "commodity" | "forex";
}

type ScanFilter = "all" | "crypto" | "commodity" | "forex";

const SCAN_CRYPTO    = CRYPTO_ASSETS.slice(0, 8);
const SCAN_COMMODITY = COMMODITY_ASSETS.slice(0, 5);
const SCAN_FOREX     = FOREX_ASSETS.slice(0, 5);

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcLevels(price: number, signal: string, category: string) {
  const slPct = category === "forex" ? 0.008 : category === "commodity" ? 0.02 : 0.045;
  const tpPct = slPct * 2.2;

  if (signal.includes("STRONG_BUY")) {
    return { entry: price, sl: price * (1 - slPct * 1.1), tp: price * (1 + tpPct * 1.3), rr: 2.6, direction: "BUY" as const };
  }
  if (signal.includes("BUY")) {
    return { entry: price, sl: price * (1 - slPct), tp: price * (1 + tpPct), rr: 2.2, direction: "BUY" as const };
  }
  if (signal.includes("STRONG_SELL")) {
    return { entry: price, sl: price * (1 + slPct * 1.1), tp: price * (1 - tpPct * 1.3), rr: 2.6, direction: "SELL" as const };
  }
  if (signal.includes("SELL")) {
    return { entry: price, sl: price * (1 + slPct), tp: price * (1 - tpPct), rr: 2.2, direction: "SELL" as const };
  }
  return null;
}

function rsiZone(rsi: number): "oversold" | "neutral" | "overbought" {
  if (rsi < 40) return "oversold";
  if (rsi > 63) return "overbought";
  return "neutral";
}

function signalClass(r: QuickScan) {
  if (r.signal.includes("BUY")) return "buy";
  if (r.signal.includes("SELL")) return "sell";
  const zone = rsiZone(r.rsi);
  if (zone === "oversold") return "watch-buy";
  if (zone === "overbought") return "watch-sell";
  return "hold";
}

function formatPrice(r: QuickScan, price?: number) {
  const p = price ?? r.price;
  if (r.category === "forex") return p.toFixed(4);
  if (r.category === "commodity") return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getBuyReason(r: QuickScan): string {
  if (r.rsi < 30) return "Deeply oversold — RSI at extreme lows, bounce likely";
  if (r.rsi < 40 && r.trend === "BULLISH") return "Oversold pullback in an uptrend — ideal entry zone";
  if (r.rsi < 45) return "RSI entering oversold territory with bullish momentum building";
  if (r.trend === "BULLISH") return "Strong uptrend confirmed — momentum favoring buyers";
  return "Multiple bullish indicators aligned — buy signal generated";
}

function getSellReason(r: QuickScan): string {
  if (r.rsi > 75) return "Extremely overbought — RSI at peak, reversal risk high";
  if (r.rsi > 65 && r.trend === "BEARISH") return "Overbought in a downtrend — bearish momentum accelerating";
  if (r.rsi > 60) return "RSI approaching overbought — consider taking profits";
  if (r.trend === "BEARISH") return "Downtrend confirmed — bearish pressure dominating";
  return "Multiple bearish signals aligned — sell / exit signal";
}

function getWatchReason(r: QuickScan): string {
  const zone = rsiZone(r.rsi);
  if (zone === "oversold") return `RSI ${r.rsi.toFixed(0)} — approaching oversold. Monitor for BUY confirmation`;
  if (zone === "overbought") return `RSI ${r.rsi.toFixed(0)} — overbought territory. Watch for exit signal`;
  return `Mixed signals — RSI ${r.rsi.toFixed(0)} neutral. Wait for clearer direction`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: QuickScan["category"] }) {
  const map = {
    crypto:    { label: "CRYPTO",    color: "#7c3aed" },
    commodity: { label: "COMMODITY", color: "#f59e0b" },
    forex:     { label: "FOREX",     color: "#3b82f6" },
  };
  const { label, color } = map[category];
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ background: `${color}20`, color }}>
      {label}
    </span>
  );
}

function RsiBar({ rsi }: { rsi: number }) {
  const zone = rsiZone(rsi);
  const color = zone === "oversold" ? "#00ff88" : zone === "overbought" ? "#ef4444" : "#f59e0b";
  return (
    <div className="relative h-2 bg-[#1e2130] rounded-full overflow-hidden w-24">
      <div className="absolute inset-0 flex">
        <div className="w-[40%] bg-[#00ff88]/10 rounded-l-full" />
        <div className="w-[23%] bg-[#f59e0b]/10" />
        <div className="w-[37%] bg-[#ef4444]/10 rounded-r-full" />
      </div>
      <div
        className="absolute top-0 h-full w-1 rounded-full -translate-x-0.5"
        style={{ left: `${rsi}%`, background: color }}
      />
    </div>
  );
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
        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: positive ? "#00ff88" : "#ef4444" }} />
      </div>
      <p className="text-xs text-[#64748b] leading-relaxed">{factor.explanation}</p>
    </div>
  );
}

function TopPickCard({ scan, role }: { scan: QuickScan; role: "buy" | "sell" | "watch" }) {
  const isBuy  = role === "buy";
  const isSell = role === "sell";
  const levels = calcLevels(scan.price, scan.signal, scan.category);
  const color  = isBuy ? "#00ff88" : isSell ? "#ef4444" : "#f59e0b";
  const Icon   = isBuy ? ArrowUpRight : isSell ? ArrowDownRight : Eye;
  const label  = isBuy ? "Best Buy" : isSell ? "Best Sell" : "Watch";

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: `${color}25`, background: `${color}05` }}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <CategoryBadge category={scan.category} />
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black text-white">{scan.label}</p>
          <p className="text-sm font-semibold" style={{ color }}>{formatPrice(scan)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color }}>{scan.strength}%</p>
          <p className="text-[10px] text-[#64748b]">strength</p>
        </div>
      </div>

      <p className="text-xs text-[#94a3b8] leading-relaxed">
        {isBuy ? getBuyReason(scan) : isSell ? getSellReason(scan) : getWatchReason(scan)}
      </p>

      {levels ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Entry", value: formatPrice(scan, levels.entry), color: "text-white" },
            { label: "Stop Loss", value: formatPrice(scan, levels.sl), color: "text-red-400" },
            { label: "Take Profit", value: formatPrice(scan, levels.tp), color: "text-[#00ff88]" },
          ].map((item) => (
            <div key={item.label} className="bg-[#0f1117] rounded-xl p-2.5 text-center border border-white/5">
              <p className="text-[10px] text-[#64748b] mb-0.5">{item.label}</p>
              <p className={`text-xs font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#0f1117] rounded-xl p-2.5 border border-white/5">
          <p className="text-xs text-[#64748b] text-center">No levels yet — signal too mixed</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-[#64748b]">
        {levels && <span>RR: <span className="text-white font-semibold">{levels.rr}:1</span></span>}
        <span>RSI: <span className="font-semibold" style={{ color: rsiZone(scan.rsi) === "oversold" ? "#00ff88" : rsiZone(scan.rsi) === "overbought" ? "#ef4444" : "#f59e0b" }}>{scan.rsi.toFixed(0)}</span></span>
        <span>Trend: <span className="text-white font-semibold">{scan.trend}</span></span>
      </div>
    </div>
  );
}

function ScanRow({ r, idx }: { r: QuickScan; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const levels = calcLevels(r.price, r.signal, r.category);
  const cls = signalClass(r);
  const isBuy  = cls === "buy";
  const isSell = cls === "sell";
  const isWatchBuy  = cls === "watch-buy";
  const isWatchSell = cls === "watch-sell";

  const sigColor = isBuy ? "#00ff88" : isSell ? "#ef4444" : isWatchBuy ? "#10b981" : isWatchSell ? "#f97316" : "#f59e0b";
  const sigLabel =
    isBuy ? r.signal.replace("STRONG_BUY", "STRONG BUY").replace(/_/g, " ")
    : isSell ? r.signal.replace("STRONG_SELL", "STRONG SELL").replace(/_/g, " ")
    : isWatchBuy  ? "WATCH · ENTRY NEAR"
    : isWatchSell ? "WATCH · EXIT NEAR"
    : "HOLD · WAIT";

  const reason = isBuy ? getBuyReason(r) : isSell ? getSellReason(r) : getWatchReason(r);

  return (
    <div className="border-b border-[#1e2130] last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 text-xs text-[#475569] font-mono flex-shrink-0">{idx + 1}</span>

        {/* Asset */}
        <div className="w-32 flex-shrink-0">
          <p className="text-sm font-bold text-white leading-tight">{r.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <CategoryBadge category={r.category} />
            <span className="text-xs text-[#64748b]">{formatPrice(r)}</span>
          </div>
        </div>

        {/* Signal badge */}
        <div className="w-36 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: sigColor }}>{sigLabel}</span>
        </div>

        {/* Levels — hide on small screens conceptually */}
        <div className="hidden md:flex flex-1 items-center gap-4 text-xs">
          {levels ? (
            <>
              <span className="text-[#64748b]">SL <span className="font-semibold text-red-400">{formatPrice(r, levels.sl)}</span></span>
              <span className="text-[#64748b]">TP <span className="font-semibold text-[#00ff88]">{formatPrice(r, levels.tp)}</span></span>
              <span className="text-[#64748b]">RR <span className="font-semibold text-white">{levels.rr}:1</span></span>
            </>
          ) : (
            <span className="text-[#475569]">Awaiting signal</span>
          )}
        </div>

        {/* RSI + bar */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <RsiBar rsi={r.rsi} />
          <span className="text-xs text-[#64748b] w-10">RSI {r.rsi.toFixed(0)}</span>
        </div>

        {/* Strength */}
        <div className="flex items-center gap-2 flex-shrink-0 w-12">
          <span className="text-xs font-semibold text-white">{r.strength}%</span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#475569] flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 bg-[#0a0d14]">
              {/* Why */}
              <div className="flex items-start gap-2 mb-4 pt-3">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: sigColor }} />
                <p className="text-xs text-[#94a3b8] leading-relaxed">{reason}</p>
              </div>

              {/* Trade levels detail */}
              {levels ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Entry Price", value: formatPrice(r, levels.entry), color: "text-white", icon: "→" },
                    { label: "Stop Loss", value: formatPrice(r, levels.sl), color: "text-red-400", icon: "↓" },
                    { label: "Take Profit", value: formatPrice(r, levels.tp), color: "text-[#00ff88]", icon: "↑" },
                    { label: "Risk / Reward", value: `${levels.rr}:1`, color: "text-[#a78bfa]", icon: "⚖" },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#0f1117] border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-[#64748b] mb-1">{item.icon} {item.label}</p>
                      <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-[#0f1117] border border-white/5 rounded-xl mb-4">
                  <p className="text-xs text-[#64748b]">
                    Signal is HOLD — no trade levels generated. Wait for RSI to reach &lt;40 (buy) or &gt;65 (sell) with momentum confirmation.
                  </p>
                </div>
              )}

              {/* RSI visual */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-[#475569] mb-1">
                  <span>Oversold (&lt;40)</span>
                  <span>Neutral</span>
                  <span>Overbought (&gt;63)</span>
                </div>
                <div className="relative h-3 bg-[#1e2130] rounded-full overflow-hidden">
                  <div className="absolute inset-0 flex">
                    <div className="w-[40%] bg-[#00ff88]/15 rounded-l-full" />
                    <div className="w-[23%] bg-[#f59e0b]/10" />
                    <div className="w-[37%] bg-[#ef4444]/15 rounded-r-full" />
                  </div>
                  <motion.div
                    initial={{ left: "50%" }}
                    animate={{ left: `${r.rsi}%` }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-0.5 bottom-0.5 w-2 rounded-full -translate-x-1"
                    style={{ background: rsiZone(r.rsi) === "oversold" ? "#00ff88" : rsiZone(r.rsi) === "overbought" ? "#ef4444" : "#f59e0b" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#475569] mt-1">
                  <span>0</span>
                  <span className="font-semibold" style={{ color: sigColor }}>RSI: {r.rsi.toFixed(1)}</span>
                  <span>100</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#64748b]">
                <span>Trend: <span className="font-semibold" style={{ color: r.trend === "BULLISH" ? "#00ff88" : r.trend === "BEARISH" ? "#ef4444" : "#f59e0b" }}>{r.trend}</span></span>
                <span>Signal strength: <span className="font-semibold text-white">{r.strength}%</span></span>
                {(isWatchBuy || isWatchSell) && (
                  <span className="text-[#f59e0b]">⚠ Setup forming — not yet confirmed</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [scanFilter, setScanFilter] = useState<ScanFilter>("all");

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

    const pushResult = (r: QuickScan) => {
      results.push(r);
      setScanResults([...results].sort((a, b) => {
        const scoreA = a.signal.includes("BUY") ? 3 : a.signal.includes("SELL") ? 2 : 1;
        const scoreB = b.signal.includes("BUY") ? 3 : b.signal.includes("SELL") ? 2 : 1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.strength - a.strength;
      }));
    };

    for (const asset of SCAN_CRYPTO) {
      try {
        const res = await fetch(`/api/signals?symbol=${asset.symbol}&interval=4h`);
        if (!res.ok) continue;
        const d = await res.json();
        if (d?.signal) {
          pushResult({
            symbol: asset.symbol, label: asset.label,
            price: d.price, signal: d.signal.signal,
            strength: d.signal.strength, trend: d.signal.trend,
            rsi: d.signal.rsi, category: "crypto",
          });
        }
      } catch { /* skip */ }
    }

    for (const asset of SCAN_COMMODITY) {
      try {
        const res = await fetch(`/api/market-signals?symbol=${encodeURIComponent(asset.symbol)}&category=commodity&interval=1d`);
        if (!res.ok) continue;
        const d = await res.json();
        if (d?.signal) {
          pushResult({
            symbol: asset.symbol, label: asset.label,
            price: d.price, signal: d.signal.signal,
            strength: d.signal.strength, trend: d.signal.trend,
            rsi: d.signal.rsi, category: "commodity",
          });
        }
      } catch { /* skip */ }
    }

    for (const asset of SCAN_FOREX) {
      try {
        const res = await fetch(`/api/market-signals?symbol=${encodeURIComponent(asset.symbol)}&category=forex&interval=1d`);
        if (!res.ok) continue;
        const d = await res.json();
        if (d?.signal) {
          pushResult({
            symbol: asset.symbol, label: asset.label,
            price: d.price, signal: d.signal.signal,
            strength: d.signal.strength, trend: d.signal.trend,
            rsi: d.signal.rsi, category: "forex",
          });
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

  // Derived data
  const buySignals  = scanResults.filter(r => r.signal.includes("BUY"));
  const sellSignals = scanResults.filter(r => r.signal.includes("SELL"));
  const holdSignals = scanResults.filter(r => !r.signal.includes("BUY") && !r.signal.includes("SELL"));
  const watchBuy    = holdSignals.filter(r => rsiZone(r.rsi) === "oversold");
  const watchSell   = holdSignals.filter(r => rsiZone(r.rsi) === "overbought");

  const topBuy  = buySignals.sort((a, b) => b.strength - a.strength)[0];
  const topSell = sellSignals.sort((a, b) => b.strength - a.strength)[0];
  const topWatch = watchBuy[0] ?? watchSell[0] ?? holdSignals[0];

  const bullish = buySignals.length;
  const bearish = sellSignals.length;
  const marketMood = scanResults.length === 0 ? null
    : bullish > bearish + 2 ? "bullish"
    : bearish > bullish + 2 ? "bearish"
    : "mixed";

  const filteredResults = (() => {
    const base = scanFilter === "all" ? scanResults : scanResults.filter(r => r.category === scanFilter);
    const buys  = base.filter(r => r.signal.includes("BUY")).sort((a, b) => b.strength - a.strength);
    const sells = base.filter(r => r.signal.includes("SELL")).sort((a, b) => b.strength - a.strength);
    const holds = base.filter(r => !r.signal.includes("BUY") && !r.signal.includes("SELL")).sort((a, b) => {
      const za = rsiZone(a.rsi) === "neutral" ? 0 : 1;
      const zb = rsiZone(b.rsi) === "neutral" ? 0 : 1;
      return zb - za || b.strength - a.strength;
    });
    return [...buys, ...sells, ...holds];
  })();

  const tabCounts = {
    all: scanResults.length,
    crypto: scanResults.filter(r => r.category === "crypto").length,
    commodity: scanResults.filter(r => r.category === "commodity").length,
    forex: scanResults.filter(r => r.category === "forex").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-[#a78bfa]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">AI Financial Advisor</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-xs text-[#64748b]">Scanning Crypto · Commodities · Forex — with Entry / SL / TP</span>
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

      {/* ── TOP PICKS — 3-column investor cards ────────────────────────── */}
      {scanResults.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-[#a78bfa]" />
            <h2 className="text-sm font-bold text-white">Top Picks Right Now</h2>
            <span className="text-xs text-[#64748b] ml-auto">{scanResults.length} assets scanned</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {topBuy   ? <TopPickCard scan={topBuy}   role="buy"   /> : (
              <div className="rounded-2xl border border-[#1e2130] p-4 flex flex-col items-center justify-center gap-2 min-h-[160px]">
                <ShieldCheck className="w-6 h-6 text-[#1e2130]" />
                <p className="text-xs text-[#475569] text-center">No buy signals yet — market scanning</p>
              </div>
            )}
            {topWatch ? <TopPickCard scan={topWatch} role="watch" /> : (
              <div className="rounded-2xl border border-[#1e2130] p-4 flex flex-col items-center justify-center gap-2 min-h-[160px]">
                <Eye className="w-6 h-6 text-[#1e2130]" />
                <p className="text-xs text-[#475569] text-center">Nothing to watch</p>
              </div>
            )}
            {topSell  ? <TopPickCard scan={topSell}  role="sell"  /> : (
              <div className="rounded-2xl border border-[#1e2130] p-4 flex flex-col items-center justify-center gap-2 min-h-[160px]">
                <ShieldAlert className="w-6 h-6 text-[#1e2130]" />
                <p className="text-xs text-[#475569] text-center">No clear sell signals</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── MARKET MOOD BRIEFING ───────────────────────────────────────── */}
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
                ? `${bullish} of ${scanResults.length} assets showing BUY signals — broad bullish momentum`
                : marketMood === "bearish"
                ? `${bearish} of ${scanResults.length} assets showing SELL signals — broad bearish pressure`
                : `Mixed market — ${bullish} buys, ${bearish} sells, ${holdSignals.length} holds across ${scanResults.length} assets`
              }
            </p>
            <p className="text-xs text-[#94a3b8]">
              {watchBuy.length > 0 && `${watchBuy.length} asset${watchBuy.length > 1 ? "s" : ""} approaching oversold (potential entry soon). `}
              {watchSell.length > 0 && `${watchSell.length} asset${watchSell.length > 1 ? "s" : ""} overbought (potential exit soon). `}
              Click any row below to see entry, stop-loss, and take-profit levels.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── PERFORMANCE ────────────────────────────────────────────────── */}
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

      {/* Signal Intelligence */}
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
        </div>
      )}

      {/* Scan Controls */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-[#94a3b8]">
            {proposals.length} pending proposal{proposals.length !== 1 ? "s" : ""}
          </span>
          <span className="hidden sm:inline text-[#1e2130]">|</span>
          <span className="hidden sm:inline text-xs text-[#64748b]">Auto-scans every 30 min</span>
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
                No setup clears the confidence bar right now. See the Investment Screener below, or hit Scan Now for a fresh analysis.
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

      {/* ── INVESTMENT SCREENER ─────────────────────────────────────────── */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2130]">
          <div>
            <h3 className="font-semibold text-white text-sm">Investment Screener</h3>
            <p className="text-[#64748b] text-xs mt-0.5">
              {buySignals.length > 0
                ? `${buySignals.length} BUY · ${sellSignals.length} SELL · ${holdSignals.length} HOLD — click any row for Entry / SL / TP`
                : "Live signals across Crypto, Commodities & Forex — click any row for details"}
            </p>
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

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-[#1e2130]">
          {(["all", "crypto", "commodity", "forex"] as ScanFilter[]).map((f) => {
            const label = f === "all" ? `All (${tabCounts.all})`
              : f === "crypto" ? `Crypto (${tabCounts.crypto})`
              : f === "commodity" ? `Commodities (${tabCounts.commodity})`
              : `Forex (${tabCounts.forex})`;
            return (
              <button
                key={f}
                onClick={() => setScanFilter(f)}
                className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                  scanFilter === f ? "text-white border-b-2 border-[#7c3aed]" : "text-[#64748b] hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-[#1e2130] bg-white/[0.01]">
          <div className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#00ff88]" /> BUY
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" /> WATCH · Entry Near
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> HOLD
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#f97316]" /> WATCH · Exit Near
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> SELL
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2130] bg-white/[0.01]">
          <span className="w-5 text-[10px] text-[#475569]">#</span>
          <span className="w-32 text-[10px] text-[#475569] uppercase tracking-wider">Asset</span>
          <span className="w-36 text-[10px] text-[#475569] uppercase tracking-wider">Signal</span>
          <span className="hidden md:block flex-1 text-[10px] text-[#475569] uppercase tracking-wider">Stop Loss / Take Profit / RR</span>
          <span className="hidden sm:block text-[10px] text-[#475569] uppercase tracking-wider w-36">RSI Zone</span>
          <span className="text-[10px] text-[#475569] uppercase tracking-wider w-12">Str</span>
          <span className="w-4" />
        </div>

        {scanLoading && filteredResults.length === 0 ? (
          <div className="py-10 text-center text-[#64748b] text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#475569]" />
            Scanning Crypto, Commodities & Forex…
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-10 text-center text-[#64748b] text-sm">
            {scanResults.length === 0 ? "Click Refresh to load live signals" : `No ${scanFilter} results`}
          </div>
        ) : (
          <div>
            {filteredResults.map((r, idx) => (
              <ScanRow key={r.symbol} r={r} idx={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Trades */}
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
                  }`}>{t.outcome ?? "Pending"}</p>
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
        ⚠️ AI analysis is based on technical indicators — not financial advice. Stop-loss and take-profit levels are algorithmically estimated. Always apply your own judgement before executing any trade.
      </div>
    </div>
  );
}
