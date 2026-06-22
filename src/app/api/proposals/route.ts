import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveProposal, denyProposal, generateProposals, getPendingProposals } from "@/lib/trade-advisor";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const proposals = await getPendingProposals(session.user.id);
  return Response.json({ proposals });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { action, proposalId, mode } = await req.json();

  if (action === "generate") {
    const results = await generateProposals(session.user.id, mode ?? "PAPER");
    return Response.json({ generated: results.length, proposals: results.map((r) => r.proposal) });
  }

  if (action === "approve" && proposalId) {
    try {
      await approveProposal(proposalId, session.user.id);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  if (action === "deny" && proposalId) {
    await denyProposal(proposalId, session.user.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
