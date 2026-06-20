import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.binanceApiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, label: true, isTestnet: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { label, apiKey, secretKey, isTestnet } = await req.json();

  if (!apiKey || !secretKey) {
    return Response.json({ error: "API key and secret are required" }, { status: 400 });
  }

  const encKey = process.env.ENCRYPTION_KEY ?? "default-key-please-change-me-32!";

  const key = await prisma.binanceApiKey.create({
    data: {
      userId: session.user.id,
      label: label ?? "My Binance Key",
      apiKey: encrypt(apiKey, encKey),
      secretKey: encrypt(secretKey, encKey),
      isTestnet: isTestnet ?? false,
    },
    select: { id: true, label: true, isTestnet: true, isActive: true, createdAt: true },
  });

  return Response.json({ key }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Key ID required" }, { status: 400 });

  await prisma.binanceApiKey.deleteMany({
    where: { id, userId: session.user.id },
  });

  return Response.json({ success: true });
}
