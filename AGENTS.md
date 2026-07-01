<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Testing

Run: `npm test` (Vitest, 134 tests, ~1s)
Coverage: `npm run test:coverage`

**Test suites:**

- `tests/unit/utils.test.ts` — `encrypt`/`decrypt`/`cn` (12 tests)
- `tests/unit/signals.test.ts` — `analyzeSignals` pure function, all 5 indicators (17 tests)
- `tests/unit/market-data.test.ts` — CoinGecko + Bybit wrappers, symbol map, all intervals (34 tests)
- `tests/unit/intelligence.test.ts` — Multi-TF engine, all 13 factors, scoring (18 tests)
- `tests/unit/bots.test.ts` — DCA/RSI/MACD/Grid executors + `runAllBots` (21 tests)
- `tests/unit/paper-trading.test.ts` — BUY/SELL execution, portfolio calc (14 tests)
- `tests/unit/trade-advisor.test.ts` — `generateProposals`, `approveProposal`, `denyProposal` (17 tests)
- `tests/unit/bot-advisor.test.ts` — `getBotRecommendation`, safety guards, retry logic (13 tests)

**Coverage (lib/):** Statements 73%, Branches 63%, Functions 73%, Lines 79%

**Known gaps (not tested):**

- `auth.ts`, `binance.ts` — auth session and Binance signed requests require live credentials
- `market-data.ts` `getMarketData` and `getVolumeTrend` — use native `fetch`, not axios; lower priority
- `news-feed.ts` — live RSS/HTTP fetching; mocked in bot-advisor tests
- Live-trade paths in `bots.ts` and `trade-advisor.ts` — require real Binance API keys

## Architecture notes

**Geo-blocking**: Binance public API returns 451 from US-hosted Netlify servers. Binance is used ONLY for live order placement (authenticated, user-provided keys).

**Primary crypto data source**: Bybit Public API (`api.bybit.com/v5/market/kline`) — no geo-block, no API key, 120 req/min. Try `category=spot` first (broadest coin coverage), then `category=linear` (USDT perpetuals). CoinGecko is the fallback.

**CoinGecko 1d interval**: Must use `market_chart` endpoint (NOT `/ohlc`). The OHLC endpoint returns 4-day candles for days > 90, resulting in only ~45 candles — below the 50-candle minimum for `analyzeSignals`.

**Rate limiting**: CoinGecko free tier = 30 req/min. Signals page uses parallel batches of 5 with 200ms gaps (crypto) or 1s gaps (commodities/forex). Intelligence engine and trade advisor use sequential calls with 350–400ms gaps.

**AI providers**: Three providers available — Claude (Anthropic, with prompt caching on system message), NVIDIA NIM, Kimi (Moonshot). MOONSHOT_API_KEY and NVIDIA_API_KEY must be set in Netlify env vars; only ANTHROPIC_API_KEY is required for core functionality.

**paper-trading.ts**: Uses `getPriceCG` from `./market-data` (NOT `getPrice` from `./binance`). This was a previously undetected bug — fixed 2026-06-23.
