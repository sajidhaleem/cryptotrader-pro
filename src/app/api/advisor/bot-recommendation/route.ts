import { NextRequest, NextResponse } from "next/server";
import { getBotRecommendation } from "@/lib/bot-advisor";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json() as { symbol?: string };
    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const recommendation = await getBotRecommendation(symbol.toUpperCase());
    return NextResponse.json(recommendation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[BotAdvisor]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
