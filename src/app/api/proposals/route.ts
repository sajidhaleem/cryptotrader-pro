import { NextRequest } from "next/server";
import { getOwnerId } from "@/lib/db";
import { approveProposal, denyProposal, generateProposals, getPendingProposals } from "@/lib/trade-advisor";
import { checkAndUpdateOutcomes } from "@/lib/outcome-tracker";

export async function GET() {
  const userId = await getOwnerId();
  // Run outcome tracker in background — don't await, keep response fast
  checkAndUpdateOutcomes(userId).catch(() => null);
  const proposals = await getPendingProposals(userId);
  return Response.json({ proposals });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerId();
  const { action, proposalId, mode } = await req.json();

  if (action === "generate") {
    const results = await generateProposals(userId, mode ?? "PAPER");
    return Response.json({ generated: results.length, proposals: results.map((r) => r.proposal) });
  }

  if (action === "approve" && proposalId) {
    try {
      await approveProposal(proposalId, userId);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  if (action === "deny" && proposalId) {
    await denyProposal(proposalId, userId);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
