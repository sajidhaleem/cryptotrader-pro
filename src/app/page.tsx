"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Bot, BarChart3, TestTube2, Zap, Shield,
  ArrowRight, ChevronRight, Star, Check
} from "lucide-react";

/* ── Data ─────────────────────────────────────────────────── */
const features = [
  { icon: BarChart3, title: "AI Trading Signals", color: "#00ff88", desc: "RSI, MACD, Bollinger Bands confluence — live buy/sell calls across 100+ pairs, refreshed every 4 hours." },
  { icon: Bot, title: "Automated Bots", color: "#7c3aed", desc: "DCA, Grid, RSI & MACD strategies running 24/7. Set it, deploy it, let it compound." },
  { icon: TrendingUp, title: "Portfolio Dashboard", color: "#06b6d4", desc: "Real-time P&L, balance tracking and performance charts synced with your Binance account." },
  { icon: TestTube2, title: "Paper Trading", color: "#f59e0b", desc: "Practice risk-free with $10,000 virtual balance. Same prices, zero risk." },
  { icon: Zap, title: "Live Execution", color: "#00ff88", desc: "Market and limit orders direct to Binance. Sub-second execution via encrypted API keys." },
  { icon: Shield, title: "Bank-Grade Security", color: "#7c3aed", desc: "AES-256 encrypted keys. Server-side signing. Your credentials never reach the client." },
];

const stats = [
  { value: "$2.4B+", label: "Volume Processed" },
  { value: "12,000+", label: "Active Traders" },
  { value: "94.2%", label: "Signal Accuracy" },
  { value: "24/7", label: "Bot Uptime" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    highlight: false,
    badge: null,
    features: ["$10k paper trading balance", "AI signals — 5 pairs", "1 trading bot", "Portfolio overview"],
    cta: "Get Started Free",
    href: "/register",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    highlight: true,
    badge: "Most Popular",
    features: ["Everything in Free", "Live Binance trading", "50+ AI signal pairs", "Unlimited bots", "Advanced analytics", "Priority support"],
    cta: "Start Pro Trial",
    href: "/register",
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    highlight: false,
    badge: null,
    features: ["Everything in Pro", "Multi-account support", "Webhook alerts", "Custom strategies", "Full API access", "Dedicated support"],
    cta: "Contact Sales",
    href: "/register",
  },
];

const signalPreviews = [
  { symbol: "BTC/USDT", signal: "STRONG BUY", strength: 88, price: "$104,210", change: "+2.41%", up: true },
  { symbol: "ETH/USDT", signal: "BUY", strength: 71, price: "$3,892", change: "+1.82%", up: true },
  { symbol: "SOL/USDT", signal: "HOLD", strength: 52, price: "$186", change: "-0.31%", up: false },
];

/* ── Animations ───────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } }),
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

/* ── Noise overlay SVG ─────────────────────────────────────── */
function GridPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090f] text-[#e2e8f0] overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090f]/80 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00ff88] flex items-center justify-center shadow-[0_0_12px_rgba(0,255,136,0.5)]">
              <span className="text-black font-black text-sm">CT</span>
            </div>
            <span className="font-bold text-white tracking-tight">CryptoTrader Pro</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-[#64748b]">
            {["Features", "Signals", "Pricing"].map((t) => (
              <a key={t} href={`#${t.toLowerCase()}`} className="hover:text-white transition-colors duration-200">{t}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#64748b] hover:text-white transition-colors px-3 py-2">Sign in</Link>
            <Link href="/register" className="flex items-center gap-1.5 text-sm bg-[#00ff88] text-black font-semibold px-5 py-2 rounded-xl hover:bg-[#00cc6a] transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <GridPattern />

        {/* Glow orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[#00ff88]/6 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-[#7c3aed]/8 blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <AnimatedGradientText className="mb-8 gap-2 border-white/10 bg-white/5 text-xs tracking-wide uppercase text-white/80">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
              Live market data from Binance
              <ChevronRight className="w-3.5 h-3.5 text-[#00ff88]" />
            </AnimatedGradientText>
          </motion.div>

          {/* Headline */}
          <div className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            {["Trade", "Smarter", "with", "AI-Powered"].map((word, i) => (
              <motion.span
                key={i}
                custom={i}
                initial="hidden"
                animate="show"
                variants={fadeUp}
                className={`mr-3 inline-block ${word === "AI-Powered" ? "text-[#00ff88]" : "text-white"}`}
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              custom={4}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="inline-block text-white"
            >
              Crypto Signals
            </motion.span>
          </div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-lg md:text-xl text-[#64748b] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Connect your Binance account, deploy automated bots, receive real-time AI signals,
            and manage your full crypto portfolio — all in one platform.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/register"
              className="group px-8 py-4 bg-[#00ff88] text-black font-bold text-base rounded-xl hover:bg-[#00cc6a] transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.4)] hover:scale-105 flex items-center gap-2 justify-center"
            >
              Start Free — No Card Required
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-white/10 text-white font-semibold text-base rounded-xl hover:border-[#00ff88]/40 hover:bg-white/5 transition-all flex items-center gap-2 justify-center"
            >
              View Demo Dashboard
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-8 flex items-center justify-center gap-4 text-sm text-[#475569]"
          >
            <div className="flex -space-x-2">
              {["🟢", "🔵", "🟣", "🟡"].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-[#1a1f2e] border-2 border-[#09090f] flex items-center justify-center text-xs">{c}</div>
              ))}
            </div>
            <span>Trusted by <strong className="text-white">12,000+</strong> traders worldwide</span>
            <div className="flex">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />)}
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-3xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-0 border border-white/8 rounded-2xl overflow-hidden"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              custom={i}
              className="text-center p-6 bg-white/[0.02] border-r border-white/8 last:border-r-0 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-[#64748b] mt-1 uppercase tracking-wide">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/5">Platform Features</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Everything you need to{" "}
              <span className="text-[#00ff88]">trade professionally</span>
            </h2>
            <p className="text-[#64748b] text-lg max-w-xl mx-auto">
              Built for both beginners starting out and quant traders scaling up.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i}
                className="group relative p-6 rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient corner */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle, ${f.color}15, transparent 70%)` }} />

                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-[#00ff88] transition-colors">{f.title}</h3>
                  <p className="text-[#64748b] text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Signals Preview ── */}
      <section id="signals" className="py-28 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge variant="outline" className="mb-4 border-[#7c3aed]/40 text-[#a78bfa] bg-[#7c3aed]/5">AI Signals</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Signals that <span className="text-[#00ff88]">actually work</span>
            </h2>
            <p className="text-[#64748b] text-lg">Multi-indicator confluence on every pair, updated every 4 hours.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {signalPreviews.map((item, i) => {
              const sigColor = item.signal.includes("STRONG BUY") ? "#00ff88" : item.signal === "BUY" ? "#22c55e" : "#f59e0b";
              return (
                <motion.div
                  key={item.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-white/15 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-white">{item.symbol}</p>
                      <p className="text-sm text-[#64748b]">{item.price}</p>
                    </div>
                    <span className={`text-sm font-semibold ${item.up ? "text-[#00ff88]" : "text-red-400"}`}>{item.change}</span>
                  </div>
                  <div className="text-2xl font-black mb-3" style={{ color: sigColor }}>{item.signal}</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[#64748b]">
                      <span>Signal Strength</span>
                      <span className="font-medium text-white">{item.strength}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.strength}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: sigColor }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/register" className="inline-flex items-center gap-2 text-[#00ff88] hover:underline font-medium text-sm">
              Get live signals for 100+ pairs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-28 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge variant="outline" className="mb-4 border-white/20 text-white/60 bg-white/5">Pricing</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-[#64748b] text-lg">Start free. Upgrade when you're ready to go live.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-7 rounded-2xl border-2 transition-all ${
                  plan.highlight
                    ? "border-[#00ff88] bg-[#00ff88]/5 shadow-[0_0_40px_rgba(0,255,136,0.12)]"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#00ff88] text-black font-bold px-4 py-1 text-xs">{plan.badge}</Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-[#64748b] text-sm">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-7">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-[#94a3b8]">
                      <Check className="w-4 h-4 text-[#00ff88] flex-shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? "bg-[#00ff88] text-black hover:bg-[#00cc6a] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]"
                      : "border border-white/10 text-white hover:border-[#00ff88]/40 hover:bg-[#00ff88]/5"
                  }`}
                >
                  {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center relative"
        >
          <div className="absolute inset-0 rounded-3xl bg-[#00ff88]/5 blur-3xl" />
          <div className="relative z-10 p-12 rounded-3xl border border-[#00ff88]/20 bg-[#00ff88]/[0.03]">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Ready to trade smarter?
            </h2>
            <p className="text-[#64748b] text-lg mb-8">
              Join 12,000+ traders. Start with $10,000 paper balance — no credit card needed.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#00ff88] text-black font-bold text-lg rounded-xl hover:bg-[#00cc6a] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,136,0.4)]"
            >
              Start Trading Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#00ff88] flex items-center justify-center">
              <span className="text-black font-black text-xs">CT</span>
            </div>
            <span className="font-bold text-white text-sm">CryptoTrader Pro</span>
          </div>
          <p className="text-xs text-[#475569] text-center">
            © {new Date().getFullYear()} CryptoTrader Pro. Not financial advice. Trade responsibly.
          </p>
          <div className="flex gap-6 text-xs text-[#475569]">
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
