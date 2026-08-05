"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[#09090f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="w-9 h-9 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_14px_rgba(0,255,136,0.4)] mb-3">
            <span className="text-black font-black text-sm">CT</span>
          </div>
          <h1 className="text-lg font-bold text-white">Sign in</h1>
          <p className="text-xs text-[#64748b] mt-1">CryptoTrader Pro</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#1e2130] bg-[#0f1117] p-5 space-y-3.5"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-[#00ff88]/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-[#1a1f2e] border border-[#1e2130] px-3 py-2 text-sm text-white placeholder:text-[#334155] focus:outline-none focus:border-[#00ff88]/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#00ff88] text-black text-sm font-bold py-2.5 hover:bg-[#00e67a] transition-colors disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
