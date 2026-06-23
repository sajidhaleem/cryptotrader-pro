import { getOwnerId } from "@/lib/db";
import { checkAndUpdateOutcomes, getPerformanceSummary } from "@/lib/outcome-tracker";

export async function GET() {
  const userId = await getOwnerId();
  await checkAndUpdateOutcomes(userId);
  const summary = await getPerformanceSummary(userId);
  return Response.json(summary);
}
