import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeSymbol } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";

  const report = await analyzeSymbol(symbol, session.user.id);
  if (!report) return Response.json({ error: "Insufficient data for analysis" }, { status: 404 });

  return Response.json({ report });
}
