"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00ff88] flex items-center justify-center">
              <span className="text-black font-bold">CT</span>
            </div>
            <span className="text-xl font-bold text-white">CryptoTrader Pro</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">Create your account</h1>
          <p className="text-[#64748b] mt-2">Start with $10,000 paper trading balance</p>
        </div>

        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/20 transition-all"
                placeholder="Satoshi Nakamoto"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/20 transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-[#1e2130] rounded-xl text-white placeholder-[#475569] focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/20 transition-all"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00ff88] text-black font-bold rounded-xl hover:bg-[#00cc6a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Free Account"}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl bg-[#00ff88]/5 border border-[#00ff88]/20">
            <p className="text-xs text-[#00ff88] font-medium mb-1">🎁 Free tier includes:</p>
            <ul className="text-xs text-[#64748b] space-y-0.5">
              <li>• $10,000 virtual trading balance</li>
              <li>• AI signals for 5 pairs</li>
              <li>• 1 automated trading bot</li>
            </ul>
          </div>

          <p className="text-center text-sm text-[#64748b] mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[#00ff88] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
