import { cookies } from "next/headers";
import { OWNER_COOKIE, ownerToken } from "@/lib/owner";

/** POST { passcode } signs this device in as the owner. DELETE signs it out. */
export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const expected = process.env.OWNER_PASSCODE;
  const token = await ownerToken();
  // Slow every attempt down a little; the passcode is long, this just blunts scripts.
  await new Promise((r) => setTimeout(r, 600));
  if (!token || !expected || passcode !== expected) {
    return Response.json({ error: "Wrong passcode" }, { status: 401 });
  }
  (await cookies()).set(OWNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(OWNER_COOKIE);
  return Response.json({ ok: true });
}
