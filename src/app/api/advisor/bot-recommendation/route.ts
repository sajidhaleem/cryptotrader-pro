import { NextRequest, NextResponse } from "next/server";
import { getBotRecommendation, type AssetCategory, type AIProvider } from "@/lib/bot-advisor";
import { DEFAULT_NIM_MODEL, type NimModelId } from "@/lib/nvidia-nim";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { symbol?: string; category?: string; provider?: string; nimModel?: string };
    const symbol   = body.symbol;
    const category = (body.category ?? "crypto") as AssetCategory;
    const provider = (body.provider === "nim" ? "nim" : "claude") as AIProvider;
    const nimModel = (body.nimModel ?? DEFAULT_NIM_MODEL) as NimModelId;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const validCategories: AssetCategory[] = ["crypto", "commodity", "forex"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "category must be crypto, commodity, or forex" }, { status: 400 });
    }

    const recommendation = await getBotRecommendation(symbol.toUpperCase(), category, provider, nimModel);
    return NextResponse.json({
      ...recommendation,
      _provider: provider,
      _nimModel: provider === "nim" ? nimModel : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[BotAdvisor]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
