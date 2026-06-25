"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  ColorType,
} from "lightweight-charts";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceChartProps {
  symbol:    string;
  interval?: string;
  height?:   number;
  compact?:  boolean;
}

const INTERVALS = [
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];

export default function PriceChart({ symbol, interval: defaultInterval = "4h", height = 280, compact = false }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<any>(null);

  const [interval,  setInterval]  = useState(defaultInterval);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [priceDir,  setPriceDir]  = useState<"up" | "down" | "flat">("flat");

  const loadData = useCallback(async (sym: string, iv: string) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/chart-data?symbol=${sym}&interval=${iv}&type=candles`);
      const data = await res.json() as { candles?: Candle[]; lastPrice?: number; error?: string };
      if (!res.ok || !data.candles) throw new Error(data.error ?? "No data");

      if (seriesRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seriesRef.current.setData(data.candles as any);
        chartRef.current?.timeScale().fitContent();
      }

      setLastPrice(prev => {
        const curr = data.lastPrice ?? 0;
        if (prev !== null) setPriceDir(curr > prev ? "up" : curr < prev ? "down" : "flat");
        return curr;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor:  "#64748b",
        fontSize:   11,
      },
      grid: {
        vertLines: { color: "#1e2130" },
        horzLines: { color: "#1e2130" },
      },
      crosshair: {
        vertLine: { color: "#334155", style: 3 },
        horzLine: { color: "#334155", style: 3 },
      },
      timeScale: {
        borderColor:    "#1e2130",
        timeVisible:    true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "#1e2130" },
      width:  containerRef.current.clientWidth,
      height,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         "#00ff88",
      downColor:       "#ef4444",
      borderUpColor:   "#00ff88",
      borderDownColor: "#ef4444",
      wickUpColor:     "#00ff88",
      wickDownColor:   "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadData(symbol, interval); }, [symbol, interval, loadData]);

  const priceColor = priceDir === "up" ? "#00ff88" : priceDir === "down" ? "#ef4444" : "#94a3b8";

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white">{symbol.replace("USDT", "/USDT")}</span>
            {lastPrice !== null && (
              <span className="text-sm font-black" style={{ color: priceColor }}>
                ${lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
            {loading && <span className="text-[10px] text-[#475569]">Loading…</span>}
          </div>
          <div className="flex gap-0.5 rounded-lg overflow-hidden border border-[#1e2130]">
            {INTERVALS.map(iv => (
              <button
                key={iv.id}
                onClick={() => setInterval(iv.id)}
                className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  interval === iv.id ? "bg-[#1e2130] text-white" : "text-[#475569] hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden" style={{ height }}>
        <div ref={containerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d14]/80 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-[#64748b]">
              <span className="w-3 h-3 border-2 border-[#475569] border-t-white rounded-full animate-spin" />
              Fetching chart data…
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-[#475569]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
