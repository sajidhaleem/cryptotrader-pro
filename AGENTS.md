<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Testing

Run: `npm test` (Vitest, 128 tests, ~1s)
Coverage: `npm run test:coverage`

**Test suites:**

- `tests/unit/utils.test.ts` — `encrypt`/`decrypt`/`cn` (12 tests)
- `tests/unit/signals.test.ts` — `analyzeSignals` pure function, all 5 indicators (17 tests)
- `tests/unit/market-data.test.ts` — CoinGecko wrappers, symbol map, all intervals (28 tests)
- `tests/unit/intelligence.test.ts` — Multi-TF engine, all 13 factors, scoring (18 tests)
- `tests/unit/bots.test.ts` — DCA/RSI/MACD/Grid executors + `runAllBots` (21 tests)
- `tests/unit/paper-trading.test.ts` — BUY/SELL execution, portfolio calc (14 tests)
- `tests/unit/trade-advisor.test.ts` — `generateProposals`, `approveProposal`, `denyProposal` (17 tests)
- `tests/unit/bot-advisor.test.ts` — `getBotRecommendation`, safety guards, retry logic (13 tests)

**Coverage (lib/):** Statements 73%, Branches 63%, Functions 73%, Lines 79%

**Known gaps (not tested):**

- `auth.ts`, `binance.ts` — auth session and Binance signed requests require live credentials
- `market-data.ts` lines 54-82, 132-153 — `getMarketData` and `getVolumeTrend` (use native `fetch`, not axios; lower priority)
- Live-trade paths in `bots.ts` and `trade-advisor.ts` — require real Binance API keys

## Architecture notes

**Geo-blocking**: Binance public API returns 451 from US-hosted Netlify servers. ALL market data now uses CoinGecko (`src/lib/market-data.ts`). Binance is used ONLY for live order placement (authenticated, user-provided keys).

**Rate limiting**: CoinGecko free tier = 30 req/min. Sequential calls with 350–400ms gaps are enforced in `intelligence.ts`, `bot-advisor.ts`. Trade advisor watchlist capped at 6 pairs with 2s between symbols.

**paper-trading.ts**: Uses `getPriceCG` from `./market-data` (NOT `getPrice` from `./binance`). This was a previously undetected bug — fixed 2026-06-23.
