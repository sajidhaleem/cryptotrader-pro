"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BarChart2, TrendingUp } from "lucide-react";

const PriceChart = dynamic(() => import("@/components/PriceChart"), { ssr: false });
const PnlChart   = dynamic(() => import("@/components/PnlChart"),   { ssr: false });

const CRYPTO_SYMBOLS = [
  { symbol: "BTCUSDT",   label: "Bitcoin (BTC)"   },
  { symbol: "ETHUSDT",   label: "Ethereum (ETH)"  },
  { symbol: "BNBUSDT",   label: "BNB"              },
  { symbol: "SOLUSDT",   label: "Solana (SOL)"     },
  { symbol: "XRPUSDT",   label: "XRP"              },
  { symbol: "ADAUSDT",   label: "Cardano (ADA)"    },
  { symbol: "DOGEUSDT",  label: "Dogecoin (DOGE)"  },
  { symbol: "LINKUSDT",  label: "Chainlink (LINK)" },
  { symbol: "AVAXUSDT",  label: "Avalanche (AVAX)" },
  { symbol: "DOTUSDT",   label: "Polkadot (DOT)"   },
];

export default function ChartsPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-[#00ff88]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Live Charts</h1>
            <p className="text-xs text-[#64748b] mt-0.5">TradingView-quality candlestick charts · P&amp;L tracking</p>
          </div>
        </div>
      </div>

      {/* Asset selector */}
      <div className="flex flex-wrap gap-2">
        {CRYPTO_SYMBOLS.map(({ symbol: sym, label }) => (
          <button
            key={sym}
            onClick={() => setSymbol(sym)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              symbol === sym
                ? "bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/30"
                : "bg-[#0f1117] text-[#64748b] border-[#1e2130] hover:text-white hover:border-[#334155]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main price chart */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
        <PriceChart symbol={symbol} interval="4h" height={360} />
      </div>

      {/* Side-by-side: two smaller charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-3 font-semibold">1H View</p>
          <PriceChart symbol={symbol} interval="1h" height={200} compact />
        </div>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-3 font-semibold">Daily View</p>
          <PriceChart symbol={symbol} interval="1d" height={200} compact />
        </div>
      </div>

      {/* P&L chart */}
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#00ff88]" />
          <h3 className="text-sm font-semibold text-white">Paper Trading P&amp;L History</h3>
          <span className="text-xs text-[#64748b]">— cumulative return across all executed trades</span>
        </div>
        <PnlChart height={200} />
      </div>

      <div className="p-4 rounded-xl bg-[#1a1f2e] text-xs text-[#475569] text-center">
        Chart data sourced from CoinGecko · Candlesticks rendered via lightweight-charts (TradingView open-source)
      </div>

    </div>
  );
}
