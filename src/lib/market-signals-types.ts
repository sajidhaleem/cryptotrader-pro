export type AssetCategory = "crypto" | "commodity" | "forex";

export const CRYPTO_ASSETS = [
  { symbol: "BTCUSDT",  label: "Bitcoin",        short: "BTC"  },
  { symbol: "ETHUSDT",  label: "Ethereum",       short: "ETH"  },
  { symbol: "BNBUSDT",  label: "BNB",            short: "BNB"  },
  { symbol: "SOLUSDT",  label: "Solana",         short: "SOL"  },
  { symbol: "XRPUSDT",  label: "XRP",            short: "XRP"  },
  { symbol: "ADAUSDT",  label: "Cardano",        short: "ADA"  },
  { symbol: "DOGEUSDT", label: "Dogecoin",       short: "DOGE" },
  { symbol: "AVAXUSDT", label: "Avalanche",      short: "AVAX" },
  { symbol: "DOTUSDT",  label: "Polkadot",       short: "DOT"  },
  { symbol: "LINKUSDT", label: "Chainlink",      short: "LINK" },
];

export const COMMODITY_ASSETS = [
  { symbol: "GC=F",  label: "Gold",         short: "GOLD", unit: "$/oz"    },
  { symbol: "SI=F",  label: "Silver",       short: "SLVR", unit: "$/oz"    },
  { symbol: "CL=F",  label: "Crude Oil",    short: "OIL",  unit: "$/bbl"   },
  { symbol: "NG=F",  label: "Natural Gas",  short: "NGAS", unit: "$/MMBtu" },
  { symbol: "HG=F",  label: "Copper",       short: "COPR", unit: "$/lb"    },
  { symbol: "PL=F",  label: "Platinum",     short: "PLAT", unit: "$/oz"    },
  { symbol: "ZW=F",  label: "Wheat",        short: "WHET", unit: "$/bu"    },
  { symbol: "ZC=F",  label: "Corn",         short: "CORN", unit: "$/bu"    },
];

export const FOREX_ASSETS = [
  { symbol: "EURUSD=X", label: "EUR / USD", short: "EURUSD" },
  { symbol: "GBPUSD=X", label: "GBP / USD", short: "GBPUSD" },
  { symbol: "JPY=X",    label: "USD / JPY", short: "USDJPY" },
  { symbol: "CHF=X",    label: "USD / CHF", short: "USDCHF" },
  { symbol: "AUDUSD=X", label: "AUD / USD", short: "AUDUSD" },
  { symbol: "CAD=X",    label: "USD / CAD", short: "USDCAD" },
  { symbol: "NZDUSD=X", label: "NZD / USD", short: "NZDUSD" },
  { symbol: "EURGBP=X", label: "EUR / GBP", short: "EURGBP" },
];
