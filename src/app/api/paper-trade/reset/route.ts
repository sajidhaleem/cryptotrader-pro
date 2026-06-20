import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.paperTrade.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.update({ where: { id: session.user.id }, data: { paperBalance: 10000 } }),
  ]);

  return Response.json({ success: true, newBalance: 10000 });
}
