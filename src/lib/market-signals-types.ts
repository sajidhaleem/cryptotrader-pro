export type AssetCategory = "crypto" | "commodity" | "forex";

export const CRYPTO_ASSETS = [
  { symbol: "BTCUSDT",  label: "Bitcoin",     short: "BTC"  },
  { symbol: "ETHUSDT",  label: "Ethereum",    short: "ETH"  },
  { symbol: "SOLUSDT",  label: "Solana",      short: "SOL"  },
  { symbol: "BNBUSDT",  label: "BNB",         short: "BNB"  },
  { symbol: "XRPUSDT",  label: "XRP",         short: "XRP"  },
  { symbol: "DOGEUSDT", label: "Dogecoin",    short: "DOGE" },
  { symbol: "ADAUSDT",  label: "Cardano",     short: "ADA"  },
  { symbol: "SUIUSDT",  label: "Sui",         short: "SUI"  },
  { symbol: "AVAXUSDT", label: "Avalanche",   short: "AVAX" },
  { symbol: "TONUSDT",  label: "Toncoin",     short: "TON"  },
  { symbol: "LINKUSDT", label: "Chainlink",   short: "LINK" },
  { symbol: "NEARUSDT", label: "NEAR",        short: "NEAR" },
  { symbol: "APTUSDT",  label: "Aptos",       short: "APT"  },
  { symbol: "INJUSDT",  label: "Injective",   short: "INJ"  },
  { symbol: "ARBUSDT",  label: "Arbitrum",    short: "ARB"  },
  { symbol: "DOTUSDT",  label: "Polkadot",    short: "DOT"  },
  { symbol: "OPUSDT",   label: "Optimism",    short: "OP"   },
  { symbol: "WIFUSDT",  label: "dogwifhat",   short: "WIF"  },
  { symbol: "PEPEUSDT", label: "Pepe",        short: "PEPE" },
  { symbol: "SEIUSDT",  label: "Sei",         short: "SEI"  },
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
