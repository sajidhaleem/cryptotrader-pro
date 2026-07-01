@AGENTS.md

## Installed Skills

The following skills are available globally in `~/.claude/skills/` and auto-loaded by Claude Code:

| Skill | Trigger |
| --- | --- |
| `webapp-testing` | Testing UI, verifying trading dashboard, Playwright browser tests |
| `claude-api` | AI signals, Anthropic SDK, model selection, streaming, tool use |
| `frontend-design` | Redesigning UI components, charts, dashboard layout |
| `pdf` | Generating trade reports, exporting P&L summaries as PDF |
| `xlsx` | Exporting trade history, portfolio data, bot performance to spreadsheet |
| `mcp-builder` | Building or extending MCP servers for Binance/CoinGecko integrations |
| `skill-creator` | Creating new project-specific skills |
| `theme-factory` | Restyling dashboard themes, dark/light mode |
| `web-artifacts-builder` | Complex multi-component UI (React + Tailwind + shadcn/ui) |

## Project: CryptoTrader Pro

**Stack**: Next.js 15 (App Router), Prisma v7, Neon DB, Tailwind, shadcn/ui  
**Deployment**: Netlify (sajidhaleem/propmanager → 52apropmanager.netlify.app)  
**Market data**: Bybit (primary, no geo-block) → CoinGecko (fallback)  
**AI providers**: Claude (Anthropic, prompt caching) | NVIDIA NIM | Kimi (Moonshot)  
**Auth**: NextAuth

### Key files

- `src/lib/market-data.ts` — `getKlinesBybit` (primary, 120 req/min) + CoinGecko wrappers; `COINGECKO_IDS` symbol map (22 pairs)
- `src/lib/market-signals-types.ts` — `CRYPTO_ASSETS` (20 coins), `COMMODITY_ASSETS`, `FOREX_ASSETS`
- `src/lib/signals.ts` — Core `analyzeSignals()` (requires ≥50 closes; returns HOLD if insufficient)
- `src/lib/intelligence.ts` — Multi-timeframe signal engine, 13 factors
- `src/lib/bot-advisor.ts` — `getBotRecommendation` — Claude Haiku AI bot config (Bybit 4h → CoinGecko fallback)
- `src/lib/news-feed.ts` — `fetchNewsContext` aggregates Yahoo RSS + Reuters + MarketWatch + CoinDesk
- `src/lib/bots.ts` — DCA / RSI / MACD / Grid bot executors
- `src/lib/paper-trading.ts` — Paper trade execution (uses `getPriceCG`, NOT `getPrice`)
- `src/lib/trade-advisor.ts` — `generateProposals`, `approveProposal`, `denyProposal`
- `src/lib/kimi.ts` — Kimi (Moonshot) AI provider
- `src/lib/nvidia-nim.ts` — NVIDIA NIM AI provider
- `src/lib/binance.ts` — Live order placement only (requires user API keys)
- `src/app/api/market-signals/route.ts` — Bybit → CoinGecko for crypto; Yahoo Finance for commodities/forex
- `src/app/signals/page.tsx` — 20 crypto + 8 commodity + 8 forex; parallel batch loading (5 at a time)

### Rules

- **Never** use Binance public API — returns 451 from Netlify (US servers)
- Crypto klines: try `getKlinesBybit(symbol, "1d", 200)` first; fall back to `getKlinesCG` only on error
- Bybit: try `category=spot` first (all coins), then `category=linear` fallback
- CoinGecko 1d interval: use `market_chart` endpoint (not OHLC — OHLC returns 4-day candles for >90 days)
- Trade advisor watchlist capped at 6 pairs, 2s between symbols
- MOONSHOT_API_KEY and NVIDIA_API_KEY must be added to Netlify env vars for Kimi/NIM to work in production
- Run `npm test` after any change to `src/lib/`
