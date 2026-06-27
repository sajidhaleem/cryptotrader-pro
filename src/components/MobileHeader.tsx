"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/wallet":    "Wallet",
  "/advisor":   "AI Advisor",
  "/trade":     "Trade",
  "/bots":      "Bots",
  "/signals":   "Signals",
  "/charts":    "Charts",
  "/settings":  "Settings",
};

export default function MobileHeader() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k + "/"))?.[1] ?? "CryptoTrader";

  return (
    <header className="md:hidden sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-[#1e2130] bg-[#09090f]/95 backdrop-blur-sm px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,136,0.4)]">
          <span className="text-black font-black text-xs">CT</span>
        </div>
      </Link>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-white">{title}</h1>

      <div className="flex-1" />

      {/* Live badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
        <span className="text-[10px] font-bold text-[#00ff88]">LIVE</span>
      </div>
    </header>
  );
}
