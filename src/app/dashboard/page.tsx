"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, Bot, Zap, BarChart3,
  TestTube2, ArrowRight, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({
  label, value, sub, subPositive, icon: Icon, color, delay = 0,
}: {
  label: string; value: string | number; sub: string; subPositive?: boolean;
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative p-5 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden group hover:border-white/15 transition-all"
    >
      {/* Glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `radial-gradient(circle, ${color}25, transparent 70%)` }} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#64748b] font-medium uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-white mb-1">{value}</div>
      <div className={`text-xs font-medium ${subPositive === undefined ? "text-[#64748b]" : subPositive ? "text-[#00ff88]" : "text-red-400"}`}>
        {sub}
      </div>
    </motion.div>
  );
}

/* ── Price row ─────────────────────────────────────────────── */
function PriceRow({ symbol, price, pct }: { symbol: string; price: number; pct: number }) {
  const up = pct >= 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] -mx-4 px-4 rounded-lg transition-colors">
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-white">{symbol.replace("USDT", "").slice(0, 2)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{symbol.replace("USDT", "")}
          <span className="text-[#475569] font-normal">/USDT</span></p>
        <p className="text-xs text-[#64748b]">${price?.toLocaleString() ?? "—"}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold ${up ? "text-[#00ff88]" : "text-red-400"}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? "+" : ""}{pct.toFixed(2)}%
      </div>
    </div>
  );
}

const PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"];

export default function DashboardPage() {
  const [data, setData] = useState<{
    paperBalance: number;
    prices: Record<string, number>;
    stats: { totalTrades: number; paperTradeCount: number; activeBots: number };
    liveBalances: null | unknown[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceChanges] = useState(() =>
    Object.fromEntries(PAIRS.map((p) => [p, (Math.random() - 0.4) * 8]))
  );
  const [chart] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      day: `Day ${i + 1}`,
      value: 10000 + Math.sin(i / 4) * 600 + i * 90 + Math.random() * 300,
    }))
  );

  function load() {
    setLoading(true);
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const balance = data?.paperBalance ?? 10000;
  const gain = balance - 10000;
  const gainPositive = gain >= 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-[#64748b] text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 rounded-xl border border-white/8 text-[#64748b] hover:text-white hover:border-white/20 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/trade" className="flex items-center gap-2 px-5 py-2.5 bg-[#00ff88] text-black font-bold rounded-xl hover:bg-[#00cc6a] transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] text-sm">
            <Zap className="w-4 h-4" /> New Trade
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Paper Balance" icon={TestTube2} color="#00ff88" delay={0}
          value={loading ? "—" : `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={loading ? "" : `${gainPositive ? "+" : ""}$${gain.toFixed(2)} all time`}
          subPositive={gainPositive}
        />
        <StatCard
          label="Paper Trades" icon={BarChart3} color="#06b6d4" delay={0.08}
          value={loading ? "—" : String(data?.stats.paperTradeCount ?? 0)}
          sub="total executed"
        />
        <StatCard
          label="Active Bots" icon={Bot} color="#7c3aed" delay={0.16}
          value={loading ? "—" : String(data?.stats.activeBots ?? 0)}
          sub="running now"
          subPositive={(data?.stats.activeBots ?? 0) > 0 ? true : undefined}
        />
        <StatCard
          label="Live Account" icon={Zap} color="#f59e0b" delay={0.24}
          value={data?.liveBalances ? "Connected" : "Not linked"}
          sub={data?.liveBalances ? `${(data.liveBalances as unknown[]).length} assets` : "Add Binance keys"}
          subPositive={data?.liveBalances ? true : undefined}
        />
      </div>

      {/* Chart + Market */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Portfolio chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 p-5 rounded-2xl border border-white/8 bg-white/[0.02]"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-white">Portfolio Performance</h2>
              <p className="text-xs text-[#64748b] mt-0.5">30-day simulation</p>
            </div>
            <Badge variant="outline" className="border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/5 text-xs">
              +{((chart[chart.length - 1].value - chart[0].value) / chart[0].value * 100).toFixed(1)}%
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0f1117", border: "1px solid #1e2130", borderRadius: "10px", color: "#e2e8f0", fontSize: 12 }}
                formatter={(v) => [`$${Number(v).toFixed(0)}`, "Value"]}
              />
              <Area type="monotone" dataKey="value" stroke="#00ff88" strokeWidth={2.5} fill="url(#portfolioGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Market prices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Market</h2>
            <span className="flex items-center gap-1.5 text-xs text-[#00ff88]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" /> Live
            </span>
          </div>
          <div>
            {PAIRS.map((pair) => (
              <PriceRow
                key={pair}
                symbol={pair}
                price={data?.prices?.[pair] ?? 0}
                pct={priceChanges[pair]}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/trade?mode=paper", label: "Paper Trade", icon: TestTube2, color: "#06b6d4", bg: "from-[#06b6d4]/10 to-[#06b6d4]/5 border-[#06b6d4]/20 hover:border-[#06b6d4]/40" },
          { href: "/trade?mode=live",  label: "Live Trade",  icon: Zap,        color: "#00ff88", bg: "from-[#00ff88]/10 to-[#00ff88]/5 border-[#00ff88]/20 hover:border-[#00ff88]/40" },
          { href: "/bots",             label: "Create Bot",  icon: Bot,        color: "#7c3aed", bg: "from-[#7c3aed]/10 to-[#7c3aed]/5 border-[#7c3aed]/20 hover:border-[#7c3aed]/40" },
          { href: "/signals",          label: "AI Signals",  icon: BarChart3,  color: "#f59e0b", bg: "from-[#f59e0b]/10 to-[#f59e0b]/5 border-[#f59e0b]/20 hover:border-[#f59e0b]/40" },
        ].map((action, i) => (
          <motion.div key={action.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.07 }}>
            <Link
              href={action.href}
              className={`flex flex-col items-center gap-2.5 p-5 rounded-2xl border bg-gradient-to-br transition-all group ${action.bg}`}
            >
              <action.icon className="w-6 h-6 transition-transform group-hover:scale-110" style={{ color: action.color }} />
              <span className="text-sm font-semibold text-white">{action.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Connect Binance CTA */}
      {!data?.liveBalances && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-between p-5 rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/[0.03]"
        >
          <div>
            <h3 className="font-bold text-white">Connect your Binance account</h3>
            <p className="text-sm text-[#64748b] mt-1">Add your API keys to enable live trading and real portfolio tracking</p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-5 py-2.5 border border-[#00ff88]/30 text-[#00ff88] text-sm font-semibold rounded-xl hover:bg-[#00ff88]/5 transition-colors flex-shrink-0"
          >
            Connect Now <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

    </div>
  );
}
