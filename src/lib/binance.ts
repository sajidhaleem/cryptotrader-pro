import axios from "axios";
import crypto from "crypto";

// api-gcp.binance.com is accessible from Cloudflare IPs; api.binance.com is not
const BASE_URL = "https://api-gcp.binance.com";
const TESTNET_URL = "https://testnet.binance.vision";

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export const POPULAR_PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "XRPUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
];

function signQuery(params: Record<string, string | number>, secret: string) {
  const query = new URLSearchParams(
    params as Record<string, string>
  ).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(query)
    .digest("hex");
  return `${query}&signature=${signature}`;
}

async function binanceFetch<T = Record<string, unknown>>(
  url: string,
  apiKey: string
): Promise<T> {
  const proxyUrl    = process.env.BINANCE_PROXY_URL;
  const proxySecret = process.env.BINANCE_PROXY_SECRET ?? "";

  if (proxyUrl) {
    const { data } = await axios.post<T>(
      proxyUrl,
      { url, apiKey },
      { headers: { "X-Proxy-Secret": proxySecret }, timeout: 12000 }
    );
    return data;
  }

  const { data } = await axios.get<T>(url, {
    headers: { "X-MBX-APIKEY": apiKey },
    timeout: 10000,
  });
  return data;
}

export async function getAccountBalance(
  apiKey: string,
  secretKey: string,
  isTestnet = false
): Promise<AccountBalance[]> {
  const base = isTestnet ? TESTNET_URL : BASE_URL;
  const params = { timestamp: Date.now(), recvWindow: 5000 };
  const query = signQuery(params, secretKey);

  const data = await binanceFetch<{ balances: AccountBalance[] }>(`${base}/api/v3/account?${query}`, apiKey);

  return data.balances.filter(
    (b: AccountBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );
}

async function binanceFetchPost<T = Record<string, unknown>>(
  url: string,
  apiKey: string
): Promise<T> {
  const proxyUrl = process.env.BINANCE_PROXY_URL;

  if (proxyUrl) {
    const { data } = await axios.post<T>(
      proxyUrl,
      { url, apiKey, method: "POST" },
      { timeout: 12000 }
    );
    return data;
  }

  const { data } = await axios.post<T>(url, {}, {
    headers: { "X-MBX-APIKEY": apiKey },
    timeout: 10000,
  });
  return data;
}

export interface BinanceOrderResult {
  fills?: { price: string; qty: string }[];
  orderId?: number;
  symbol?: string;
  status?: string;
}

export async function placeOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  isTestnet = false
): Promise<BinanceOrderResult> {
  const base = isTestnet ? TESTNET_URL : BASE_URL;
  const params = {
    symbol,
    side,
    type: "MARKET",
    quantity: quantity.toString(),
    timestamp: Date.now(),
    recvWindow: 5000,
  };
  const query = signQuery(params, secretKey);
  return binanceFetchPost<BinanceOrderResult>(`${base}/api/v3/order?${query}`, apiKey);
}

