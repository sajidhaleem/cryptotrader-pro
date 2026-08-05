import { NextRequest } from "next/server";
import { prisma, getOwnerId } from "@/lib/db";
import { fetchPsxQuote } from "@/lib/psx-price";

export async function GET() {
  const userId = await getOwnerId();
  const holdings = await prisma.psxHolding.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const priced = await Promise.all(
    holdings.map(async (h) => {
      const costBasis = h.quantity * h.avgBuyRate;
      try {
        const { price, change1d } = await fetchPsxQuote(`${h.symbol}.KA`);
        const marketValue = h.quantity * price;
        const unrealizedPL = marketValue - costBasis;
        return {
          ...h,
          price,
          change1d,
          marketValue,
          costBasis,
          unrealizedPL,
          unrealizedPLPct: costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0,
          priceSource: "live" as const,
        };
      } catch {
        // Yahoo Finance unreachable or symbol not found, fall back to avg buy rate
        return {
          ...h,
          price: h.avgBuyRate,
          change1d: 0,
          marketValue: costBasis,
          costBasis,
          unrealizedPL: 0,
          unrealizedPLPct: 0,
          priceSource: "unavailable" as const,
        };
      }
    })
  );

  const totalMarketValue = priced.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostBasis = priced.reduce((sum, h) => sum + h.costBasis, 0);
  const totalUnrealizedPL = totalMarketValue - totalCostBasis;

  return Response.json({
    holdings: priced,
    totals: {
      marketValue: totalMarketValue,
      costBasis: totalCostBasis,
      unrealizedPL: totalUnrealizedPL,
      unrealizedPLPct: totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0,
      shares: priced.reduce((sum, h) => sum + h.quantity, 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const { symbol, company, quantity, avgBuyRate, form } = await req.json();

  if (!symbol || !company || !quantity || !avgBuyRate) {
    return Response.json(
      { error: "symbol, company, quantity, and avgBuyRate are required" },
      { status: 400 }
    );
  }

  const holding = await prisma.psxHolding.upsert({
    where: { userId_symbol: { userId, symbol: symbol.toUpperCase() } },
    create: {
      userId,
      symbol: symbol.toUpperCase(),
      company,
      quantity,
      avgBuyRate,
      form: form ?? "Physical",
    },
    update: {
      company,
      quantity,
      avgBuyRate,
      form: form ?? "Physical",
    },
  });

  return Response.json({ holding }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const userId = await getOwnerId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Holding ID required" }, { status: 400 });

  await prisma.psxHolding.deleteMany({
    where: { id, userId },
  });

  return Response.json({ success: true });
}
