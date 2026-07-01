export type PSXSector = "Banking" | "Energy" | "Cement" | "Fertilizer" | "Power" | "Technology" | "Pharma" | "Textile";

export const SECTOR_COLORS: Record<PSXSector, { text: string; bg: string; border: string; dot: string }> = {
  Banking:    { text: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/25",   dot: "bg-blue-400"   },
  Energy:     { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/25", dot: "bg-orange-400" },
  Cement:     { text: "text-slate-400",  bg: "bg-slate-400/10",  border: "border-slate-400/25",  dot: "bg-slate-400"  },
  Fertilizer: { text: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/25",  dot: "bg-green-400"  },
  Power:      { text: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/25", dot: "bg-purple-400" },
  Technology: { text: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/25",   dot: "bg-cyan-400"   },
  Pharma:     { text: "text-pink-400",   bg: "bg-pink-400/10",   border: "border-pink-400/25",   dot: "bg-pink-400"   },
  Textile:    { text: "text-amber-300",  bg: "bg-amber-300/10",  border: "border-amber-300/25",  dot: "bg-amber-300"  },
};

export interface PSXAsset {
  symbol: string;
  label: string;
  short: string;
  sector: PSXSector;
}

export const PSX_ASSETS: PSXAsset[] = [
  // Banking
  { symbol: "HBL.KA",   label: "Habib Bank Limited",     short: "HBL",   sector: "Banking"    },
  { symbol: "MCB.KA",   label: "MCB Bank",                short: "MCB",   sector: "Banking"    },
  { symbol: "UBL.KA",   label: "United Bank Limited",     short: "UBL",   sector: "Banking"    },
  { symbol: "MEBL.KA",  label: "Meezan Bank",             short: "MEBL",  sector: "Banking"    },
  { symbol: "BAHL.KA",  label: "Bank AL-Habib",           short: "BAHL",  sector: "Banking"    },
  // Energy
  { symbol: "PSO.KA",   label: "Pakistan State Oil",      short: "PSO",   sector: "Energy"     },
  { symbol: "OGDC.KA",  label: "Oil & Gas Dev. Co.",      short: "OGDC",  sector: "Energy"     },
  { symbol: "PPL.KA",   label: "Pakistan Petroleum",      short: "PPL",   sector: "Energy"     },
  { symbol: "MARI.KA",  label: "Mari Petroleum",          short: "MARI",  sector: "Energy"     },
  // Cement
  { symbol: "LUCK.KA",  label: "Lucky Cement",            short: "LUCK",  sector: "Cement"     },
  { symbol: "MLCF.KA",  label: "Maple Leaf Cement",       short: "MLCF",  sector: "Cement"     },
  // Fertilizer
  { symbol: "ENGRO.KA", label: "Engro Corporation",       short: "ENGRO", sector: "Fertilizer" },
  { symbol: "EFERT.KA", label: "Engro Fertilizers",       short: "EFERT", sector: "Fertilizer" },
  { symbol: "FFC.KA",   label: "Fauji Fertilizer Co.",    short: "FFC",   sector: "Fertilizer" },
  // Power
  { symbol: "HUBC.KA",  label: "Hub Power Company",       short: "HUBC",  sector: "Power"      },
  { symbol: "KAPCO.KA", label: "Kot Addu Power Co.",      short: "KAPCO", sector: "Power"      },
  // Technology
  { symbol: "TRG.KA",   label: "TRG Pakistan",            short: "TRG",   sector: "Technology" },
  { symbol: "SYS.KA",   label: "Systems Limited",         short: "SYS",   sector: "Technology" },
  // Pharma
  { symbol: "SEARL.KA", label: "The Searle Company",      short: "SEARL", sector: "Pharma"     },
  // Textile
  { symbol: "NML.KA",   label: "Nishat Mills",            short: "NML",   sector: "Textile"    },
];

export const PSX_SECTORS: PSXSector[] = [
  "Banking", "Energy", "Cement", "Fertilizer", "Power", "Technology", "Pharma", "Textile"
];
