"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutDashboard, Zap, Bot, LineChart, Settings,
  Brain, Shield, Wallet, BarChart2, Menu, ChevronRight,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/wallet",    label: "Wallet",      icon: Wallet },
  { href: "/advisor",   label: "AI Advisor",  icon: Brain,     badge: "AI"  },
  { href: "/trade",     label: "Trade",       icon: Zap },
  { href: "/bots",      label: "Bots",        icon: Bot },
  { href: "/signals",   label: "Signals",     icon: LineChart },
  { href: "/charts",    label: "Charts",      icon: BarChart2, badge: "NEW" },
  { href: "/settings",  label: "Settings",    icon: Settings },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const currentPage = nav.find(n => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)));

  return (
    <>
      {/* Top bar */}
      <header className="flex md:hidden items-center justify-between px-4 h-14 bg-[#0a0a0f] border-b border-[#1e2130] flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,136,0.4)]">
            <span className="text-black font-black text-xs">CT</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">CryptoTrader</p>
            <p className="text-[#00ff88] text-[9px] font-semibold tracking-wider">PRO</p>
          </div>
        </Link>

        {currentPage && (
          <span className="text-white font-semibold text-sm">{currentPage.label}</span>
        )}

        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-xl bg-[#1e2130] flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Slide-out drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[260px] p-0 bg-[#0a0a0f] border-r border-[#1e2130] flex flex-col">

          {/* Drawer header */}
          <div className="px-5 h-14 flex items-center border-b border-[#1e2130] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,136,0.4)]">
                <span className="text-black font-black text-xs">CT</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">CryptoTrader</p>
                <p className="text-[#00ff88] text-[9px] font-semibold tracking-wider">PRO</p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {nav.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-[#00ff88] text-black"
                      : "text-[#64748b] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-black" : ""}`} />
                  {label}
                  {badge && !active && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#7c3aed]/20 text-[#a78bfa]">{badge}</span>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-black/60" />}
                </Link>
              );
            })}
          </nav>

          {/* Personal badge */}
          <div className="px-3 pb-4 pt-2 border-t border-[#1e2130] flex-shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00ff88]/30 to-[#7c3aed]/30 flex items-center justify-center flex-shrink-0 border border-white/10">
                <Shield className="w-4 h-4 text-[#00ff88]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Personal</p>
                <p className="text-xs text-[#64748b]">Private · Encrypted</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
