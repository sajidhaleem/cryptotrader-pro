// Owner vs. public visitor.
//
// The app is a single-owner tool that is also shown publicly (it is linked from
// saigoc.com). Anyone without the owner cookie is a demo visitor: they get
// their own empty "demo" user (no Binance key) and every write is refused in
// src/proxy.ts. The owner signs in at /owner with OWNER_PASSCODE.
//
// The cookie holds HMAC(passcode, fixed label), never the passcode itself, so
// changing OWNER_PASSCODE signs every device out. No OWNER_PASSCODE set means
// nobody is the owner: the whole app is demo-only, which is the safe default.
// Web Crypto only, so this runs in the proxy (edge) and in route handlers.

export const OWNER_COOKIE = "ct_owner";

export async function ownerToken(): Promise<string | null> {
  const passcode = process.env.OWNER_PASSCODE;
  if (!passcode) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(passcode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("cryptotrader-owner-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare, so the cookie check leaks nothing through timing. */
export async function isOwnerToken(value: string | undefined): Promise<boolean> {
  const expected = await ownerToken();
  if (!expected || !value || value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ value.charCodeAt(i);
  return diff === 0;
}
