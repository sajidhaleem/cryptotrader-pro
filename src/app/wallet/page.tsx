"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, RefreshCw, TrendingUp, TrendingDown,
  ArrowRight, Lock, AlertCircle, FlaskConical,
} from "lucide-react";
import type { WalletAsset } from "@/app/api/wallet/route";

/* ── Coin colors ───────────────────────────────────────────── */
const COIN_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", BNB: "#f3ba2f", SOL: "#9945ff",
  ADA: "#0033ad", XRP: "#346aa9", DOGE: "#c2a633", DOT: "#e6007a",
  USDT: "#26a17b", USDC: "#2775ca", BUSD: "#f0b90b", LINK: "#2a5ada",
  AVAX: "#e84142", MATIC: "#8247e5", POL: "#8247e5", LTC: "#a0a0a0",
  SHIB: "#ffa409", UNI: "#ff007a", ATOM: "#6f7390", NEAR: "#00ec97",
  APT: "#0d9373", ARB: "#12aaff", OP: "#ff0420", TRX: "#ef0027",
  TON: "#0098ea", PEPE: "#479b4a", FIL: "#0090ff", ICP: "#29abe2",
  SUI: "#4da2ff", INJ: "#00b2ff", SEI: "#9d3ef7", FET: "#1e88e5",
};

function coinColor(asset: string): string {
  return COIN_COLORS[asset] ?? "#64748b";
}

/* ── Format helpers ────────────────────────────────────────── */
function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(decimals)}`;
}

function fmtBalance(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}

/* ── Allocation bar ────────────────────────────────────────── */
function AllocationBar({ assets }: { assets: WalletAsset[] }) {
  const top = assets.filter((a) => (a.usdValue ?? 0) > 0).slice(0, 6);
  const otherPct = 100 - top.reduce((s, a) => s + a.allocation, 0);

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {top.map((a) => (
          <div
            key={a.asset}
            style={{ width: `${a.allocation}%`, background: coinColor(a.asset) }}
            title={`${a.asset}: ${a.allocation.toFixed(1)}%`}
          />
        ))}
        {otherPct > 0.5 && (
          <div style={{ width: `${otherPct}%` }} className="bg-[#334155]" title="Other" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {top.map((a) => (
          <div key={a.asset} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: coinColor(a.asset) }} />
            <span className="text-xs text-[#64748b]">{a.asset}</span>
            <span className="text-xs text-[#94a3b8]">{a.allocation.toFixed(1)}%</span>
          </div>
        ))}
        {otherPct > 0.5 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#334155]" />
            <span className="text-xs text-[#64748b]">Other {otherPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Asset row ─────────────────────────────────────────────── */
function AssetRow({ asset, index }: { asset: WalletAsset; index: number }) {
  const up = (asset.change24h ?? 0) >= 0;
  const color = coinColor(asset.asset);
  const hasPrice = asset.usdValue !== null;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group"
    >
      {/* Rank */}
      <td className="py-4 pl-5 pr-3 text-xs text-[#475569] w-10">{index + 1}</td>

      {/* Coin */}
      <td className="py-4 pr-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
            style={{ background: `${color}20`, border: `1px solid ${color}40` }}
          >
            <span style={{ color }}>{asset.asset.slice(0, 2)}</span>
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{asset.asset}</p>
            {asset.isStable && (
              <span className="text-[10px] text-[#26a17b] bg-[#26a17b]/10 px-1.5 py-0.5 rounded font-medium">Stable</span>
            )}
            {asset.locked > 0 && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded font-medium">
                <Lock className="w-2.5 h-2.5" />{fmtBalance(asset.locked)} locked
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Balance */}
      <td className="py-4 pr-6 text-right">
        <p className="text-white text-sm font-medium tabular-nums">{fmtBalance(asset.total)}</p>
        {asset.locked > 0 && (
          <p className="text-[10px] text-[#64748b]">{fmtBalance(asset.free)} available</p>
        )}
      </td>

      {/* Price */}
      <td className="py-4 pr-6 text-right">
        {hasPrice && asset.price !== null ? (
          <p className="text-[#94a3b8] text-sm tabular-nums">
            {asset.isStable ? "$1.00" : fmt(asset.price, asset.price < 0.01 ? 6 : 2)}
          </p>
        ) : (
          <p className="text-[#475569] text-sm">—</p>
        )}
      </td>

      {/* USD Value */}
      <td className="py-4 pr-6 text-right">
        {hasPrice ? (
          <p className="text-white font-semibold text-sm tabular-nums">{fmt(asset.usdValue ?? 0)}</p>
        ) : (
          <p className="text-[#475569] text-sm">—</p>
        )}
      </td>

      {/* Allocation */}
      <td className="py-4 pr-6 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(asset.allocation, 100)}%`, background: color }}
            />
          </div>
          <span className="text-xs text-[#64748b] w-10 text-right">
            {asset.allocation > 0 ? `${asset.allocation.toFixed(1)}%` : "—"}
          </span>
        </div>
      </td>

      {/* 24h change */}
      <td className="py-4 pr-5 text-right">
        {!asset.isStable && asset.change24h !== null ? (
          <div className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-[#00ff88]" : "text-red-400"}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? "+" : ""}{asset.change24h.toFixed(2)}%
          </div>
        ) : (
          <span className="text-xs text-[#475569]">{asset.isStable ? "—" : "N/A"}</span>
        )}
      </td>
    </motion.tr>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
interface WalletData {
  hasApiKey: boolean;
  assets: WalletAsset[];
  totalUsd: number;
  isTestnet: boolean;
  error: string | null;
}

const STABLES = new Set(["USDT","BUSD","USDC","TUSD","DAI","FDUSD","USDP","PYUSD","EURI","EUR","GBP"]);

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Step 1: server signs the Binance request (auth + decrypt + HMAC)
      const signRes  = await fetch("/api/wallet");
      const signData = await signRes.json() as {
        hasApiKey: boolean; isTestnet?: boolean;
        signedUrl?: string; binanceKey?: string; proxyUrl?: string; error?: string;
      };

      if (!signData.hasApiKey) {
        setData({ hasApiKey: false, assets: [], totalUsd: 0, isTestnet: false, error: null });
        return;
      }
      if (signData.error || !signData.signedUrl) {
        setData({ hasApiKey: true, assets: [], totalUsd: 0, isTestnet: signData.isTestnet ?? false, error: signData.error ?? "Could not build request." });
        return;
      }

      // Step 2: browser POSTs to Cloudflare Worker — runs at CF edge near user, not US
      const proxyUrl = signData.proxyUrl || "https://binance-proxy.sajidhaleem.workers.dev";
      let rawBalances: { asset: string; free: string; locked: string }[];
      try {
        const binRes  = await fetch(proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: signData.signedUrl, apiKey: signData.binanceKey }),
        });
        const binData = await binRes.json() as { balances?: { asset: string; free: string; locked: string }[]; code?: number; msg?: string };
        if (binData.code !== undefined && binData.code !== 200) {
          throw new Error(`Binance error ${binData.code}: ${binData.msg}`);
        }
        rawBalances = (binData.balances ?? []).filter(
          (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );
      } catch (err) {
        setData({ hasApiKey: true, assets: [], totalUsd: 0, isTestnet: signData.isTestnet ?? false, error: String(err) });
        return;
      }

      // Step 3: fetch prices server-side (CoinGecko, not geo-blocked from Netlify)
      const assetNames = rawBalances.map((b) => b.asset).join(",");
      const pricesRes  = await fetch(`/api/wallet?mode=prices&assets=${assetNames}`);
      const pricesData = await pricesRes.json() as { prices: Record<string, { price: number; change24h: number }> };
      const prices     = pricesData.prices ?? {};

      // Step 4: combine
      const assets: WalletAsset[] = rawBalances.map((b) => {
        const total    = parseFloat(b.free) + parseFloat(b.locked);
        const isStable = STABLES.has(b.asset);
        const price    = isStable ? 1 : (prices[b.asset]?.price ?? null);
        const change24h = isStable ? 0 : (prices[b.asset]?.change24h ?? null);
        const usdValue = price !== null ? total * price : null;
        return { asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked), total, price, change24h, usdValue, allocation: 0, isStable };
      });

      const totalUsd = assets.reduce((s, a) => s + (a.usdValue ?? 0), 0);
      assets.forEach((a) => { a.allocation = totalUsd > 0 ? ((a.usdValue ?? 0) / totalUsd) * 100 : 0; });
      assets.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

      setData({ hasApiKey: true, assets, totalUsd, isTestnet: signData.isTestnet ?? false, error: null });
    } catch {
      setData({ hasApiKey: true, assets: [], totalUsd: 0, isTestnet: false, error: "Unexpected error loading wallet." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const assets = data?.assets ?? [];
  const knownUsd = assets.filter((a) => a.usdValue !== null).reduce((s, a) => s + (a.usdValue ?? 0), 0);
  const unknownCount = assets.filter((a) => a.usdValue === null).length;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#00ff88]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Wallet</h1>
            <p className="text-[#64748b] text-sm">
              {data?.isTestnet ? "Testnet account" : "Live Binance account"}
            </p>
          </div>
          {data?.isTestnet && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20">
              <FlaskConical className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span className="text-xs font-semibold text-[#f59e0b]">Testnet</span>
            </div>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl border border-white/8 text-[#64748b] hover:text-white hover:border-white/20 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* No API key state */}
      {!loading && !data?.hasApiKey && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center mb-5">
            <Wallet className="w-7 h-7 text-[#475569]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Binance account connected</h2>
          <p className="text-[#64748b] max-w-sm mb-6">
            Add your Binance API keys in Settings to see your real-time portfolio balance here.
          </p>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-5 py-2.5 border border-[#00ff88]/30 text-[#00ff88] text-sm font-semibold rounded-xl hover:bg-[#00ff88]/5 transition-colors"
          >
            Go to Settings <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Error state */}
      {!loading && data?.hasApiKey && data.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Balance fetch failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{data.error}</p>
          </div>
        </motion.div>
      )}

      {/* Portfolio summary */}
      {(loading || (data?.hasApiKey && !data.error)) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="sm:col-span-2 p-6 rounded-2xl border border-white/8 bg-white/[0.02]"
            >
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider mb-2">Total Portfolio Value</p>
              {loading ? (
                <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <p className="text-4xl font-black text-white tabular-nums">
                  {fmt(knownUsd)}
                  {unknownCount > 0 && (
                    <span className="ml-2 text-base font-normal text-[#64748b]">+ {unknownCount} unpriced</span>
                  )}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="p-6 rounded-2xl border border-white/8 bg-white/[0.02]"
            >
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider mb-2">Assets</p>
              {loading ? (
                <div className="h-10 w-16 bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <p className="text-4xl font-black text-white">{assets.length}</p>
              )}
            </motion.div>
          </div>

          {/* Allocation bar */}
          {!loading && assets.some((a) => (a.usdValue ?? 0) > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]"
            >
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider mb-4">Allocation</p>
              <AllocationBar assets={assets} />
            </motion.div>
          )}

          {/* Holdings table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="font-bold text-white">Holdings</h2>
              <span className="flex items-center gap-1.5 text-xs text-[#00ff88]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" /> Live
              </span>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-white/5 animate-pulse" />
                    <div className="flex-1 h-4 bg-white/5 rounded animate-pulse" />
                    <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
                    <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="p-12 text-center text-[#64748b] text-sm">
                No assets found in this account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="py-3 pl-5 pr-3 text-left text-[10px] text-[#475569] uppercase tracking-wider font-medium w-10">#</th>
                      <th className="py-3 pr-4 text-left text-[10px] text-[#475569] uppercase tracking-wider font-medium">Asset</th>
                      <th className="py-3 pr-6 text-right text-[10px] text-[#475569] uppercase tracking-wider font-medium">Balance</th>
                      <th className="py-3 pr-6 text-right text-[10px] text-[#475569] uppercase tracking-wider font-medium">Price</th>
                      <th className="py-3 pr-6 text-right text-[10px] text-[#475569] uppercase tracking-wider font-medium">Value</th>
                      <th className="py-3 pr-6 text-right text-[10px] text-[#475569] uppercase tracking-wider font-medium">Portfolio</th>
                      <th className="py-3 pr-5 text-right text-[10px] text-[#475569] uppercase tracking-wider font-medium">24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a, i) => (
                      <AssetRow key={a.asset} asset={a} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}

    </div>
  );
}
