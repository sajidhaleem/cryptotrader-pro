"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

interface WidgetHolding {
  id: string;
  symbol: string;
  marketValue: number;
}

interface WidgetResponse {
  holdings: WidgetHolding[];
  totals: {
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPct: number;
  };
}

const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];

function rs(n: number): string {
  return `₨${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Compact preview of "My Holdings" surfaced on the PSX Market page itself.
// Renders nothing if the visitor isn't signed in or has no holdings yet.
export default function HoldingsWidget() {
  const [data, setData] = useState<WidgetResponse | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/psx-holdings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: WidgetResponse | null) => {
        if (json && json.holdings.length > 0) {
          setData(json);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!visible || !data) return null;

  const plUp = data.totals.unrealizedPL >= 0;
  const totalValue = data.totals.marketValue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href="/psx-portfolio"
        className="block rounded-2xl border border-[#1e2130] bg-[#0f1117] p-4 hover:border-amber-500/30 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25">
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Your Holdings</span>
          </div>
          <ArrowRight className="w-4 h-4 text-[#475569] group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-black text-white tabular-nums leading-none">{rs(totalValue)}</p>
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${plUp ? "text-[#00ff88]" : "text-red-400"}`}>
              {plUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {plUp ? "+" : ""}
              {data.totals.unrealizedPLPct.toFixed(1)}%
            </div>
          </div>

          <div className="flex-1 max-w-[180px]">
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              {data.holdings.map((h, i) => (
                <div
                  key={h.id}
                  style={{
                    width: `${Math.max((h.marketValue / totalValue) * 100, 1)}%`,
                    background: PALETTE[i % PALETTE.length],
                  }}
                />
              ))}
            </div>
            <p className="text-[10px] text-[#64748b] mt-1.5 text-right">{data.holdings.length} securities</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
