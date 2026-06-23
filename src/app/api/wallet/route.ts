import { prisma, getOwnerId } from "@/lib/db";
import { getAccountBalance } from "@/lib/binance";
import { decrypt } from "@/lib/utils";
import axios from "axios";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const ASSET_TO_CG: Record<string, string> = {
  BTC:  "bitcoin",
  ETH:  "ethereum",
  BNB:  "binancecoin",
  SOL:  "solana",
  ADA:  "cardano",
  XRP:  "ripple",
  DOGE: "dogecoin",
  DOT:  "polkadot",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  MATIC:"matic-network",
  POL:  "matic-network",
  LTC:  "litecoin",
  SHIB: "shiba-inu",
  UNI:  "uniswap",
  ATOM: "cosmos",
  NEAR: "near",
  APT:  "aptos",
  ARB:  "arbitrum",
  OP:   "optimism",
  TRX:  "tron",
  TON:  "the-open-network",
  PEPE: "pepe",
  FIL:  "filecoin",
  ICP:  "internet-computer",
  HBAR: "hedera-hashgraph",
  VET:  "vechain",
  ALGO: "algorand",
  MANA: "decentraland",
  SAND: "the-sandbox",
  AXS:  "axie-infinity",
  INJ:  "injective-protocol",
  SUI:  "sui",
  SEI:  "sei-network",
  WIF:  "dogwifcoin",
  BONK: "bonk",
  FET:  "fetch-ai",
  RENDER: "render-token",
  TAO:  "bittensor",
  JUP:  "jupiter-exchange-solana",
  PYTH: "pyth-network",
  W:    "wormhole",
};

const STABLECOINS = new Set([
  "USDT", "BUSD", "USDC", "TUSD", "DAI", "FDUSD", "USDP", "PYUSD",
  "EURI", "EUR", "GBP",
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

export async function GET() {
  const userId = await getOwnerId();
  const encKey = process.env.ENCRYPTION_KEY ?? "";

  const apiKey = await prisma.binanceApiKey.findFirst({
    where: { userId, isActive: true },
  });

  if (!apiKey) {
    return Response.json({ hasApiKey: false, assets: [], totalUsd: 0, isTestnet: false, error: null });
  }

  let rawBalances;
  try {
    const decryptedKey = decrypt(apiKey.apiKey, encKey);
    const decryptedSecret = decrypt(apiKey.secretKey, encKey);
    rawBalances = await getAccountBalance(decryptedKey, decryptedSecret, apiKey.isTestnet);
  } catch {
    return Response.json({
      hasApiKey: true,
      error: "Could not fetch balances from Binance. Check your API keys in Settings.",
      assets: [],
      totalUsd: 0,
      isTestnet: apiKey.isTestnet,
    });
  }

  const assets: WalletAsset[] = rawBalances.map((b) => ({
    asset: b.asset,
    free: parseFloat(b.free),
    locked: parseFloat(b.locked),
    total: parseFloat(b.free) + parseFloat(b.locked),
    price: null,
    change24h: null,
    usdValue: null,
    allocation: 0,
    isStable: STABLECOINS.has(b.asset),
  }));

  // Stablecoins are always $1
  assets.forEach((a) => {
    if (a.isStable) {
      a.price = 1;
      a.change24h = 0;
      a.usdValue = a.total;
    }
  });

  // Batch-fetch CoinGecko prices for known non-stable assets
  const cgAssets = assets.filter((a) => !a.isStable && ASSET_TO_CG[a.asset]);
  if (cgAssets.length > 0) {
    const ids = [...new Set(cgAssets.map((a) => ASSET_TO_CG[a.asset]))].join(",");
    try {
      const { data } = await axios.get<Record<string, { usd: number; usd_24h_change: number }>>(
        `${COINGECKO_BASE}/simple/price`,
        { params: { ids, vs_currencies: "usd", include_24hr_change: true }, timeout: 8000 }
      );
      cgAssets.forEach((a) => {
        const cgId = ASSET_TO_CG[a.asset];
        const d = data[cgId];
        if (d) {
          a.price = d.usd;
          a.change24h = d.usd_24h_change;
          a.usdValue = a.total * d.usd;
        }
      });
    } catch {
      // CoinGecko unavailable — prices stay null
    }
  }

  const totalUsd = assets.reduce((sum, a) => sum + (a.usdValue ?? 0), 0);
  assets.forEach((a) => {
    a.allocation = totalUsd > 0 ? ((a.usdValue ?? 0) / totalUsd) * 100 : 0;
  });
  assets.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  return Response.json({ hasApiKey: true, assets, totalUsd, isTestnet: apiKey.isTestnet, error: null });
}
