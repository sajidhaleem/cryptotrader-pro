"use client";

import { useState } from "react";

export default function OwnerPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (res.ok) window.location.href = "/dashboard";
    else setError("Wrong passcode.");
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#09090f] p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-7">
        <h1 className="text-xl font-semibold text-white">Owner sign in</h1>
        <p className="mt-2 text-sm text-white/60">
          Everyone else sees a read-only demo with no exchange account connected.
        </p>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
          className="mt-6 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-emerald-400"
          required
        />
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
        <button
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
