import { NextRequest } from "next/server";
import { analyzeSignals } from "@/lib/signals";
import { PSX_ASSETS } from "@/lib/psx-types";
import { fetchPsxQuote } from "@/lib/psx-price";
import { fetchKse100 } from "@/lib/kse100";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "HBL.KA";

  const asset = PSX_ASSETS.find(a => a.symbol === symbol);

  try {
    // Yahoo Finance doesn't carry the KSE-100 index at all — PSX's own Data
    // Portal System is the real source for it.
    const { closes, history, price, change1d } =
      symbol === "^KSE100" ? await fetchKse100() : await fetchPsxQuote(symbol);
    const signal = analyzeSignals(closes);

    return Response.json({
      symbol,
      label: asset?.label ?? (symbol === "^KSE100" ? "KSE-100 Index" : symbol),
      sector: asset?.sector ?? "Other",
      price,
      change1d,
      signal,
      history: history.slice(-60), // ~3 trading months, enough for the trend chart
      timestamp: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch PSX data";
    return Response.json({ error: msg }, { status: 500 });
  }
}
