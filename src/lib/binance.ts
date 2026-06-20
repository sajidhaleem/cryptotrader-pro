import axios from "axios";
import crypto from "crypto";

const BASE_URL = "https://api.binance.com";
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

export interface OrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

export interface TickerPrice {
  symbol: string;
  price: string;
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

export async function getPrice(symbol: string): Promise<number> {
  const { data } = await axios.get<TickerPrice>(
    `${BASE_URL}/api/v3/ticker/price`,
    { params: { symbol } }
  );
  return parseFloat(data.price);
}

export async function getPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  const { data } = await axios.get<TickerPrice[]>(
    `${BASE_URL}/api/v3/ticker/price`
  );
  const prices: Record<string, number> = {};
  data.forEach((t) => {
    if (symbols.includes(t.symbol)) {
      prices[t.symbol] = parseFloat(t.price);
    }
  });
  return prices;
}

export async function get24hrStats(symbol: string) {
  const { data } = await axios.get(`${BASE_URL}/api/v3/ticker/24hr`, {
    params: { symbol },
  });
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume),
    quoteVolume: parseFloat(data.quoteVolume),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
  };
}

export async function getKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 100
): Promise<Kline[]> {
  const { data } = await axios.get(`${BASE_URL}/api/v3/klines`, {
    params: { symbol, interval, limit },
  });
  return data.map((k: number[]) => ({
    openTime: k[0],
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
    closeTime: k[6],
  }));
}

export async function getOrderBook(
  symbol: string,
  limit: number = 10
): Promise<OrderBook> {
  const { data } = await axios.get(`${BASE_URL}/api/v3/depth`, {
    params: { symbol, limit },
  });
  return { bids: data.bids, asks: data.asks };
}

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

export async function getAccountBalance(
  apiKey: string,
  secretKey: string,
  isTestnet = false
): Promise<AccountBalance[]> {
  const base = isTestnet ? TESTNET_URL : BASE_URL;
  const params = { timestamp: Date.now(), recvWindow: 5000 };
  const query = signQuery(params, secretKey);

  const { data } = await axios.get(`${base}/api/v3/account?${query}`, {
    headers: { "X-MBX-APIKEY": apiKey },
  });

  return data.balances.filter(
    (b: AccountBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );
}

export async function placeOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  isTestnet = false
) {
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

  const { data } = await axios.post(
    `${base}/api/v3/order?${query}`,
    {},
    { headers: { "X-MBX-APIKEY": apiKey } }
  );
  return data;
}

export async function placeLimitOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  price: number,
  isTestnet = false
) {
  const base = isTestnet ? TESTNET_URL : BASE_URL;
  const params = {
    symbol,
    side,
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: quantity.toString(),
    price: price.toString(),
    timestamp: Date.now(),
    recvWindow: 5000,
  };
  const query = signQuery(params, secretKey);

  const { data } = await axios.post(
    `${base}/api/v3/order?${query}`,
    {},
    { headers: { "X-MBX-APIKEY": apiKey } }
  );
  return data;
}

export async function getTradeHistory(
  apiKey: string,
  secretKey: string,
  symbol: string,
  isTestnet = false
) {
  const base = isTestnet ? TESTNET_URL : BASE_URL;
  const params = { symbol, timestamp: Date.now(), limit: 50 };
  const query = signQuery(params, secretKey);

  const { data } = await axios.get(`${base}/api/v3/myTrades?${query}`, {
    headers: { "X-MBX-APIKEY": apiKey },
  });
  return data;
}
