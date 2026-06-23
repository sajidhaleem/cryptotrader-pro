import { NextRequest } from "next/server";
import { getOwnerId } from "@/lib/db";
import { analyzeSymbol } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const userId = await getOwnerId();
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";

  try {
    const report = await analyzeSymbol(symbol, userId);
    if (!report) return Response.json({ error: "Insufficient data for analysis" }, { status: 404 });
    return Response.json({ report });
  } catch (err) {
    console.error("[Analyze]", err);
    return Response.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
