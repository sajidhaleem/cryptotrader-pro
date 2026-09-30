import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { OWNER_COOKIE, isOwnerToken } from "@/lib/owner";

// Edge-safe: only the lightweight config, no Prisma adapter or bcrypt here.
const { auth } = NextAuth(authConfig);

const psxGate = auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

// Paths a visitor may POST to: NextAuth's own sign-in (PSX) and the owner sign-in.
const OPEN_WRITES = ["/api/auth/", "/api/owner"];

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/psx")) return psxGate(req, ev as never);

  // Public visitors are read-only: every write (orders, keys, bots, proposals,
  // paper trades, AI calls) is refused unless the owner cookie is present.
  // Reads are fine: getOwnerId() gives visitors the empty demo user.
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (
    write &&
    !OPEN_WRITES.some((p) => pathname.startsWith(p)) &&
    !(await isOwnerToken(req.cookies.get(OWNER_COOKIE)?.value))
  ) {
    return NextResponse.json(
      { error: "This is a read-only demo. Changes are disabled.", demo: true },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/psx/:path*", "/psx-portfolio/:path*", "/api/:path*"],
};
