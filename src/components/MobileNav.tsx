"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Zap, Bot, LineChart, Settings,
  Brain, Wallet, BarChart2, MoreHorizontal, X, Shield, TrendingUp,
} from "lucide-react";

// Always visible in the bottom bar
const primaryTabs = [
  { href: "/dashboard", label: "Home",    icon: LayoutDashboard, exact: true },
  { href: "/signals",   label: "Signals", icon: LineChart },
  { href: "/psx",       label: "PSX",     icon: TrendingUp, psx: true },
  { href: "/bots",      label: "Bots",    icon: Bot },
];

// Grouped items in the More sheet
const navGroups = [
  {
    label: "Crypto",
    items: [
      { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, exact: true },
      { href: "/signals",   label: "Signals",    icon: LineChart },
      { href: "/charts",    label: "Charts",     icon: BarChart2, badge: "NEW" },
      { href: "/trade",     label: "Trade",      icon: Zap },
      { href: "/bots",      label: "Bots",       icon: Bot },
    ],
  },
  {
    label: "Pakistan",
    items: [
      { href: "/psx", label: "PSX Market", icon: TrendingUp, badge: "PKR", psx: true },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/advisor", label: "AI Advisor", icon: Brain, badge: "AI" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/wallet",   label: "Wallet",   icon: Wallet },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const primaryHrefs = primaryTabs.map(t => t.href);

export default function MobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const moreIsActive = !primaryHrefs.some(href => {
    const tab = primaryTabs.find(t => t.href === href);
    return isActive(href, tab?.exact);
  });

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t border-[#1e2130] bg-[#09090f]/95 backdrop-blur-md">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href, tab.exact);
          const isPsx = (tab as { psx?: boolean }).psx;
          const activeColor = isPsx ? "text-amber-400" : "text-[#00ff88]";
          const inactiveColor = "text-[#475569] hover:text-[#94a3b8]";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? activeColor : inactiveColor
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? activeColor : "text-[#475569]"}`} />
              {tab.label}
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setSheetOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
            moreIsActive ? "text-[#00ff88]" : "text-[#475569] hover:text-[#94a3b8]"
          }`}
        >
          <MoreHorizontal className={`h-5 w-5 ${moreIsActive ? "text-[#00ff88]" : "text-[#475569]"}`} />
          More
        </button>
      </nav>

      {/* ── More sheet (slides up) ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="md:hidden fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-[#0a0a0f] border-t border-[#1e2130] max-h-[85dvh]"
            >
              {/* Handle + header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1e2130] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,136,0.4)]">
                    <span className="text-black font-black text-xs">CT</span>
                  </div>
                  <span className="text-[15px] font-semibold tracking-tight text-white">CryptoTrader Pro</span>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e2130] text-[#64748b] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav groups — scrollable */}
              <div className="flex-1 overflow-y-auto py-3 px-3">
                {navGroups.map((group) => (
                  <div key={group.label} className="mb-4">
                    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, (item as { exact?: boolean }).exact);
                        const isPsx = (item as { psx?: boolean }).psx;
                        const badgeVal = (item as { badge?: string }).badge;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSheetOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                              active
                                ? isPsx
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-[#00ff88]/15 text-[#00ff88]"
                                : isPsx
                                  ? "text-[#64748b] hover:bg-amber-500/8 hover:text-amber-300"
                                  : "text-[#64748b] hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 ${
                                active
                                  ? isPsx ? "text-amber-400" : "text-[#00ff88]"
                                  : isPsx ? "text-amber-700" : "text-[#475569]"
                              }`}
                            />
                            {item.label}
                            {badgeVal && !active && (
                              <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                isPsx
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-[#7c3aed]/20 text-[#a78bfa]"
                              }`}>
                                {badgeVal}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Account footer */}
              <div className="border-t border-[#1e2130] px-4 py-3 shrink-0 pb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00ff88]/30 to-[#7c3aed]/30 border border-white/10">
                    <Shield className="h-4 w-4 text-[#00ff88]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white">Personal Account</p>
                    <span className="inline-block text-[10px] font-medium px-1.5 py-0 rounded mt-0.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20">
                      Private
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
