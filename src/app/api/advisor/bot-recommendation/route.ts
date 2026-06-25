import { NextRequest, NextResponse } from "next/server";
import { getBotRecommendation, type AssetCategory, type AIProvider } from "@/lib/bot-advisor";
import { DEFAULT_NIM_MODEL, type NimModelId } from "@/lib/nvidia-nim";
import { DEFAULT_KIMI_MODEL, type KimiModelId } from "@/lib/kimi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { symbol?: string; category?: string; provider?: string; nimModel?: string; kimiModel?: string };
    const symbol   = body.symbol;
    const category = (body.category ?? "crypto") as AssetCategory;
    const provider = (["nim", "kimi"].includes(body.provider ?? "") ? body.provider : "claude") as AIProvider;
    const nimModel  = (body.nimModel  ?? DEFAULT_NIM_MODEL)  as NimModelId;
    const kimiModel = (body.kimiModel ?? DEFAULT_KIMI_MODEL) as KimiModelId;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const validCategories: AssetCategory[] = ["crypto", "commodity", "forex"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "category must be crypto, commodity, or forex" }, { status: 400 });
    }

    const recommendation = await getBotRecommendation(symbol.toUpperCase(), category, provider, nimModel, kimiModel);
    return NextResponse.json({
      ...recommendation,
      _provider:   provider,
      _nimModel:   provider === "nim"  ? nimModel  : undefined,
      _kimiModel:  provider === "kimi" ? kimiModel : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[BotAdvisor]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
