"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT", "XRPUSDT", "AVAXUSDT"];
const INTERVALS = ["1h", "4h", "1d"];

interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function TradePageInner() {
  const searchParams = useSearchParams();
  const defaultSymbol = searchParams.get("symbol") ?? "BTCUSDT";

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState("1h");
  const [klines, setKlines] = useState<Kline[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/binance?action=klines&symbol=${symbol}&interval=${interval}`);
      const data = await res.json();
      if (data.klines) {
        setKlines(data.klines);
        setPrice(data.klines[data.klines.length - 1].close);
      }
    } catch {
      // silently fail
    }
  }, [symbol, interval]);

  useEffect(() => {
    fetchChart();
    const id = window.setInterval(fetchChart, 30000);
    return () => window.clearInterval(id);
  }, [fetchChart]);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => setHasApiKey(d.hasApiKey ?? false))
      .catch(() => setHasApiKey(false));
  }, []);

  async function handleTrade() {
    if (!quantity || parseFloat(quantity) <= 0) {
      setResult({ success: false, message: "Enter a valid quantity" });
      return;
    }
    if (!hasApiKey) {
      setResult({ success: false, message: "Add your Binance API key in Settings first" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, quantity: parseFloat(quantity) }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success) {
        setResult({ success: true, message: `Order placed — ID ${data.orderId} (${data.status})` });
        setQuantity("");
      } else {
        setResult({ success: false, message: data.error ?? "Order failed" });
      }
    } catch {
      setLoading(false);
      setResult({ success: false, message: "Network error — order not placed" });
    }
  }

  const chartData = klines.map((k) => ({
    time: new Date(k.openTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    close: k.close,
    high: k.high,
    low: k.low,
    volume: k.volume,
  }));

  const priceChange =
    klines.length >= 2
      ? ((klines[klines.length - 1].close - klines[0].close) / klines[0].close) * 100
      : 0;

  const total = price && quantity ? price * parseFloat(quantity || "0") : 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Trading Terminal</h1>
          <p className="text-[#64748b] text-sm mt-0.5">Market orders via Binance — real execution</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/5">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-xs font-semibold text-[#00ff88]">LIVE</span>
        </div>
      </div>

      {/* API key warning */}
      {hasApiKey === false && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-300 flex items-center justify-between">
          <span>⚠️ No Binance API key configured — add one to start trading.</span>
          <Link href="/settings" className="ml-4 underline font-semibold flex-shrink-0">Go to Settings →</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Chart area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex gap-2 flex-wrap">
                {PAIRS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSymbol(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      symbol === p
                        ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                        : "text-[#64748b] hover:text-white border border-transparent hover:border-[#1e2130]"
                    }`}
                  >
                    {p.replace("USDT", "")}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                {INTERVALS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      interval === i
                        ? "bg-[#1a1f2e] text-white"
                        : "text-[#64748b] hover:text-white"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Price info */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-bold text-white">
                {price ? `$${price.toLocaleString()}` : "Loading..."}
              </span>
              <span className={`text-sm font-medium ${priceChange >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </span>
              <span className="text-xs text-[#64748b]">{symbol}</span>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={priceChange >= 0 ? "#00ff88" : "#ef4444"} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={priceChange >= 0 ? "#00ff88" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#475569", fontSize: 10 }} width={80}
                  tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip
                  contentStyle={{ background: "#0f1117", border: "1px solid #1e2130", borderRadius: "8px", color: "#e2e8f0", fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, "Price"]}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={priceChange >= 0 ? "#00ff88" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#tradeGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Panel */}
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-white">Place Live Order</h2>

          {/* BUY / SELL tabs */}
          <div className="flex rounded-xl overflow-hidden border border-[#1e2130]">
            <button
              onClick={() => setSide("BUY")}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                side === "BUY" ? "bg-[#22c55e] text-white" : "bg-[#0f1117] text-[#64748b] hover:text-white"
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setSide("SELL")}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                side === "SELL" ? "bg-[#ef4444] text-white" : "bg-[#0f1117] text-[#64748b] hover:text-white"
              }`}
            >
              SELL
            </button>
          </div>

          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Symbol</label>
            <div className="px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white text-sm font-medium">
              {symbol}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Quantity (coin units)</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.001"
              min="0"
              step="0.001"
              className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 text-sm"
            />
          </div>

          {total > 0 && (
            <div className="p-3 rounded-xl bg-[#1a1f2e] text-xs space-y-1">
              <div className="flex justify-between text-[#64748b]">
                <span>Market Price</span>
                <span className="text-white">${price?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#64748b]">
                <span>Est. Total</span>
                <span className="text-white">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#64748b]">
                <span>Est. Fee (0.1%)</span>
                <span className="text-white">${(total * 0.001).toFixed(2)}</span>
              </div>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-xl text-sm ${result.success ? "bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88]" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
              {result.message}
            </div>
          )}

          <button
            onClick={handleTrade}
            disabled={loading || !quantity || hasApiKey === false}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              side === "BUY"
                ? "bg-[#22c55e] text-white hover:bg-[#16a34a]"
                : "bg-[#ef4444] text-white hover:bg-[#dc2626]"
            }`}
          >
            {loading ? "Placing Order..." : hasApiKey === false ? "Add API Key First" : `${side} ${symbol.replace("USDT", "")} on Binance`}
          </button>

          <p className="text-xs text-center text-[#475569]">
            Market order · Executed immediately on Binance
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#64748b]">Loading...</div>}>
      <TradePageInner />
    </Suspense>
  );
}
