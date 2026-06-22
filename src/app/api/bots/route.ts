import { NextRequest } from "next/server";
import { prisma, getOwnerId } from "@/lib/db";

export async function GET() {
  const userId = await getOwnerId();
  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ bots });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const body = await req.json();
  const { name, strategy, symbol, config } = body;

  if (!name || !strategy || !symbol || !config) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const bot = await prisma.bot.create({
    data: {
      userId,
      name,
      strategy,
      symbol,
      config,
      status: "STOPPED",
    },
  });

  return Response.json({ bot }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getOwnerId();
  const { id, status } = await req.json();

  const bot = await prisma.bot.findFirst({
    where: { id, userId },
  });

  if (!bot) {
    return Response.json({ error: "Bot not found" }, { status: 404 });
  }

  const updated = await prisma.bot.update({
    where: { id },
    data: { status },
  });

  return Response.json({ bot: updated });
}

export async function DELETE(req: NextRequest) {
  const userId = await getOwnerId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Bot ID required" }, { status: 400 });

  await prisma.bot.deleteMany({
    where: { id, userId },
  });

  return Response.json({ success: true });
}
