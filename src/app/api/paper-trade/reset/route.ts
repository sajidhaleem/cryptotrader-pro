import { prisma, getOwnerId } from "@/lib/db";

export async function POST() {
  const userId = await getOwnerId();

  await prisma.$transaction([
    prisma.paperTrade.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { paperBalance: 10000 } }),
  ]);

  return Response.json({ success: true, newBalance: 10000 });
}
