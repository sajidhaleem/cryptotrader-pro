import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ bots });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, strategy, symbol, config } = body;

  if (!name || !strategy || !symbol || !config) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const bot = await prisma.bot.create({
    data: {
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json();

  const bot = await prisma.bot.findFirst({
    where: { id, userId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Bot ID required" }, { status: 400 });

  await prisma.bot.deleteMany({
    where: { id, userId: session.user.id },
  });

  return Response.json({ success: true });
}
