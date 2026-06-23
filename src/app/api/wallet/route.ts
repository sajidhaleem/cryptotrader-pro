import { prisma, getOwnerId } from "@/lib/db";
import { decrypt } from "@/lib/utils";
import crypto from "crypto";
import axios from "axios";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export const ASSET_TO_CG: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana",
  ADA: "cardano", XRP: "ripple", DOGE: "dogecoin", DOT: "polkadot",
  LINK: "chainlink", AVAX: "avalanche-2", MATIC: "matic-network",
  POL: "matic-network", LTC: "litecoin", SHIB: "shiba-inu",
  UNI: "uniswap", ATOM: "cosmos", NEAR: "near", APT: "aptos",
  ARB: "arbitrum", OP: "optimism", TRX: "tron",
  TON: "the-open-network", PEPE: "pepe", FIL: "filecoin",
  ICP: "internet-computer", HBAR: "hedera-hashgraph", VET: "vechain",
  ALGO: "algorand", MANA: "decentraland", SAND: "the-sandbox",
  AXS: "axie-infinity", INJ: "injective-protocol", SUI: "sui",
  SEI: "sei-network", WIF: "dogwifcoin", BONK: "bonk",
  FET: "fetch-ai", RENDER: "render-token", TAO: "bittensor",
  JUP: "jupiter-exchange-solana", PYTH: "pyth-network", W: "wormhole",
};

export const STABLECOINS = new Set([
  "USDT", "BUSD", "USDC", "TUSD", "DAI", "FDUSD",
  "USDP", "PYUSD", "EURI", "EUR", "GBP",
]);

export interface WalletAsset {
  asset: string;
  free: number;
  locked: number;
  total: number;
  price: number | null;
  change24h: number | null;
  usdValue: number | null;
  allocation: number;
  isStable: boolean;
}

function signQuery(params: Record<string, string | number>, secret: string): string {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  const signature = crypto.createHmac("sha256", secret).update(query).digest("hex");
  return `${query}&signature=${signature}`;
}

/** GET /api/wallet?mode=sign  — returns signed Binance URL for browser to call via CF proxy */
/** GET /api/wallet?mode=prices&assets=BTC,ETH — returns CoinGecko prices */
/** GET /api/wallet  — full balance+prices (server-side, for non-geo-blocked environments) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  const userId = await getOwnerId();
  const encKey = process.env.ENCRYPTION_KEY ?? "";

  // ── Mode: prices ─────────────────────────────────────────────────────────
  if (mode === "prices") {
    const assetList = (searchParams.get("assets") ?? "").split(",").filter(Boolean);
    const prices: Record<string, { price: number; change24h: number }> = {};

    // Stablecoins
    for (const a of assetList) {
      if (STABLECOINS.has(a)) prices[a] = { price: 1, change24h: 0 };
    }

    // CoinGecko batch
    const cgAssets = assetList.filter((a) => !STABLECOINS.has(a) && ASSET_TO_CG[a]);
    if (cgAssets.length > 0) {
      const ids = [...new Set(cgAssets.map((a) => ASSET_TO_CG[a]))].join(",");
      try {
        const { data } = await axios.get<Record<string, { usd: number; usd_24h_change: number }>>(
          `${COINGECKO_BASE}/simple/price`,
          { params: { ids, vs_currencies: "usd", include_24hr_change: true }, timeout: 8000 }
        );
        for (const a of cgAssets) {
          const d = data[ASSET_TO_CG[a]];
          if (d) prices[a] = { price: d.usd, change24h: d.usd_24h_change };
        }
      } catch { /* CoinGecko unavailable — return what we have */ }
    }

    return Response.json({ prices });
  }

  // ── Mode: sign (or default) ───────────────────────────────────────────────
  const apiKey = await prisma.binanceApiKey.findFirst({
    where: { userId, isActive: true },
  });

  if (!apiKey) {
    return Response.json({ hasApiKey: false });
  }

  try {
    const decryptedKey    = decrypt(apiKey.apiKey, encKey);
    const decryptedSecret = decrypt(apiKey.secretKey, encKey);
    const base   = apiKey.isTestnet ? "https://testnet.binance.vision" : "https://api.binance.com";
    const params = { timestamp: Date.now(), recvWindow: 10000 };
    const query  = signQuery(params, decryptedSecret);

    return Response.json({
      hasApiKey:  true,
      isTestnet:  apiKey.isTestnet,
      signedUrl:  `${base}/api/v3/account?${query}`,
      binanceKey: decryptedKey,
      proxyUrl:   process.env.BINANCE_PROXY_URL ?? "",
    });
  } catch {
    return Response.json({
      hasApiKey: true,
      error: "Failed to decrypt API keys. Please re-enter them in Settings.",
    });
  }
}
