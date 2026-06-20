import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { executePaperTrade, getPaperPortfolio } from "@/lib/paper-trading";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const portfolio = await getPaperPortfolio(session.user.id);
  return Response.json({ portfolio });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol, side, quantity } = await req.json();
  if (!symbol || !side || !quantity) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await executePaperTrade(session.user.id, symbol, side, quantity);
  return Response.json(result, { status: result.success ? 200 : 400 });
}
