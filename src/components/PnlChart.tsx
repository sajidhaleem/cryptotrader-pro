"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, LineStyle, ColorType } from "lightweight-charts";

interface PnlPoint {
  time:  number;
  value: number;
}

interface PnlChartProps {
  height?: number;
}

export default function PnlChart({ height = 160 }: PnlChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null);

  const [total,   setTotal]   = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty,   setEmpty]   = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor:  "#64748b",
        fontSize:   10,
      },
      grid: {
        vertLines: { color: "#1e2130" },
        horzLines: { color: "#1e2130" },
      },
      crosshair: {
        vertLine: { color: "#334155", style: LineStyle.Dashed },
        horzLine: { color: "#334155", style: LineStyle.Dashed },
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

    const series = chart.addSeries(LineSeries, {
      color:     "#00ff88",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    fetch("/api/chart-data?type=pnl")
      .then(r => r.json())
      .then((data: { points?: PnlPoint[]; total?: number }) => {
        if (!data.points || data.points.length === 0) {
          setEmpty(true);
          setLoading(false);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(data.points as any);
        chart.timeScale().fitContent();
        setTotal(data.total ?? null);

        const lastVal = data.points[data.points.length - 1]?.value ?? 0;
        if (lastVal < 0) series.applyOptions({ color: "#ef4444" });

        series.createPriceLine({
          price: 0, color: "#334155", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "break-even",
        });

        setLoading(false);
      })
      .catch(() => { setLoading(false); setEmpty(true); });

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [height]);

  const totalColor = total === null ? "#64748b" : total >= 0 ? "#00ff88" : "#ef4444";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-white">Cumulative P&amp;L</span>
        {total !== null && (
          <span className="text-sm font-black" style={{ color: totalColor }}>
            {total >= 0 ? "+" : ""}${total.toFixed(2)}
          </span>
        )}
      </div>
      <div className="relative rounded-xl overflow-hidden" style={{ height }}>
        <div ref={containerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d14]/80 rounded-xl">
            <span className="text-xs text-[#475569]">Loading P&amp;L…</span>
          </div>
        )}
        {empty && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <p className="text-xs text-[#475569]">No trade history yet</p>
            <p className="text-[10px] text-[#334155]">Approve proposals on the Advisor page to start tracking</p>
          </div>
        )}
      </div>
    </div>
  );
}
