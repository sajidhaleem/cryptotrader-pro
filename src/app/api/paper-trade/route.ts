import { NextRequest } from "next/server";
import { getOwnerId } from "@/lib/db";
import { executePaperTrade, getPaperPortfolio } from "@/lib/paper-trading";

export async function GET() {
  const userId = await getOwnerId();
  const portfolio = await getPaperPortfolio(userId);
  return Response.json({ portfolio });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const { symbol, side, quantity } = await req.json();
  if (!symbol || !side || !quantity) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await executePaperTrade(userId, symbol, side, quantity);
  return Response.json(result, { status: result.success ? 200 : 400 });
}
