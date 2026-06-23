import { NextRequest } from "next/server";
import { prisma, getOwnerId } from "@/lib/db";
import { encrypt } from "@/lib/utils";

export async function GET() {
  const userId = await getOwnerId();
  const keys = await prisma.binanceApiKey.findMany({
    where: { userId },
    select: { id: true, label: true, isTestnet: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ keys });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const { label, apiKey, secretKey, isTestnet } = await req.json();

  if (!apiKey || !secretKey) {
    return Response.json({ error: "API key and secret are required" }, { status: 400 });
  }

  const encKey = process.env.ENCRYPTION_KEY ?? "";

  const key = await prisma.binanceApiKey.create({
    data: {
      userId,
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
  const userId = await getOwnerId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return Response.json({ error: "Key ID required" }, { status: 400 });

  await prisma.binanceApiKey.deleteMany({
    where: { id, userId },
  });

  return Response.json({ success: true });
}
