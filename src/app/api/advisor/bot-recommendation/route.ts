import { NextRequest, NextResponse } from "next/server";
import { getBotRecommendation, type AssetCategory } from "@/lib/bot-advisor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { symbol?: string; category?: string };
    const symbol   = body.symbol;
    const category = (body.category ?? "crypto") as AssetCategory;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const validCategories: AssetCategory[] = ["crypto", "commodity", "forex"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "category must be crypto, commodity, or forex" }, { status: 400 });
    }

    const recommendation = await getBotRecommendation(symbol.toUpperCase(), category);
    return NextResponse.json(recommendation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[BotAdvisor]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
