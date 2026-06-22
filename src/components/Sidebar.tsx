"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Zap, Bot, LineChart, Settings,
  LogOut, CreditCard, ChevronRight, Brain
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/advisor",   label: "AI Advisor", icon: Brain, badge: "AI" },
  { href: "/trade",     label: "Trade",       icon: Zap },
  { href: "/bots",      label: "Bots",        icon: Bot },
  { href: "/signals",   label: "Signals",     icon: LineChart },
  { href: "/settings",  label: "Settings",    icon: Settings },
];

interface Props {
  user: { name?: string | null; email?: string | null };
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#1e2130] bg-[#0a0a0f]">

      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-[#1e2130]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_12px_rgba(0,255,136,0.4)] group-hover:shadow-[0_0_18px_rgba(0,255,136,0.6)] transition-shadow">
            <span className="text-black font-black text-sm">CT</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">CryptoTrader</p>
            <p className="text-[#00ff88] text-[10px] font-semibold tracking-wider">PRO</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                active
                  ? "text-black bg-[#00ff88]"
                  : "text-[#64748b] hover:text-white hover:bg-white/5"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-[#00ff88]"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
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

      {/* Upgrade card */}
      <div className="px-3 pb-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#7c3aed]/20 to-[#7c3aed]/5 border border-[#7c3aed]/20">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-[#a78bfa]" />
            <span className="text-xs font-bold text-[#a78bfa] uppercase tracking-wide">Free Plan</span>
          </div>
          <p className="text-xs text-[#64748b] mb-3 leading-relaxed">Upgrade to unlock live trading and unlimited bots</p>
          <Link
            href="/settings"
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#7c3aed] text-white text-xs font-semibold rounded-lg hover:bg-[#6d28d9] transition-colors"
          >
            Upgrade to Pro <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* User */}
      <div className="px-3 pb-4 pt-2 border-t border-[#1e2130]">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00ff88]/30 to-[#7c3aed]/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 border border-white/10">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name ?? "Trader"}</p>
            <p className="text-xs text-[#64748b] truncate">{user?.email ?? ""}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-[#64748b]"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </aside>
  );
}
