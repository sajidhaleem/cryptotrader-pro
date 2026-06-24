import { getOwnerId } from "@/lib/db";
import { runAllBots } from "@/lib/bots";

export async function POST() {
  const userId = await getOwnerId();
  const results = await runAllBots(userId);
  return Response.json({ results, ranAt: new Date().toISOString() });
}
