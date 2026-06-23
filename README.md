# CryptoTrader Pro

Personal AI-powered crypto trading platform. The AI watches the market 24/7, proposes high-confidence trades for your approval, runs automated bots, and **learns from every outcome** to improve its signals over time.

Live at **[cryptotrader-pro.netlify.app](https://cryptotrader-pro.netlify.app)**

---

## What It Does

- **AI Financial Advisor** — scans 12 pairs across 13 indicators and 3 timeframes every 30 minutes, proposes trades with entry/stop/target, and adapts its signal weights based on real win/loss outcomes
- **Automated Bots** — DCA, RSI, MACD, and Grid strategies that run on a schedule in paper or live mode
- **Learning Loop** — every resolved trade updates per-indicator win/loss counts; indicators that call the market correctly get boosted weight on future proposals
- **Performance Dashboard** — win rate, total P&L, avg confidence, per-indicator accuracy table, and recent trade history
- **Binance Integration** — live order execution via your own API keys (optional; paper trading works without keys)

---

## Stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript |
| Styling | Tailwind v4 |
| Database | Prisma v7 + Neon PostgreSQL |
| Charts | Recharts |
| Indicators | `technicalindicators` npm package |
| Market Data | CoinGecko (free tier, 30 req/min) |
| Deployment | Netlify + GitHub Actions |

---

## Key Architecture Decisions

**Geo-blocking**: Binance public API returns HTTP 451 from US Netlify servers. All market data uses CoinGecko. Binance is used only for authenticated live order placement with user-provided keys.

**Single-user**: No NextAuth. `getOwnerId()` in `src/lib/db.ts` upserts a fixed owner record on first call. All routes call `getOwnerId()` instead of reading a session.

**Rate limiting**: CoinGecko free tier = 30 req/min. Sequential calls with 350–400 ms gaps enforced throughout `intelligence.ts`, `bot-advisor.ts`, and `trade-advisor.ts`.

**Learning loop**: `SignalWeight` table stores wins/losses per indicator. `outcome-tracker.ts` evaluates executed proposals after ≥1h — WIN if price hits take-profit, LOSS if it hits stop-loss, or ±1.5% after 24h. Each resolved trade upserts signal weights. `intelligence.ts` reads these via `getUserWeights()` when scoring future proposals.

---

## Project Structure

```text
src/
  app/
    api/
      portfolio/      — balance, prices, Binance key status
      proposals/      — generate / approve / deny AI proposals
      performance/    — win rate, P&L, signal accuracy
      signals/        — per-pair indicator analysis
      bots/           — CRUD + start/stop
      bot-advisor/    — Claude strategy recommendation
    dashboard/        — stat cards, portfolio chart, market prices
    advisor/          — financial advisor AI (proposals + performance)
    signals/          — indicator breakdown by pair + timeframe
    trade/            — manual paper/live terminal
    bots/             — bot management
    settings/         — Binance API key storage
  lib/
    intelligence.ts   — 13-indicator, 3-timeframe scoring engine
    trade-advisor.ts  — proposal generation, approval, denial
    outcome-tracker.ts — WIN/LOSS resolution + signal weight updates
    bots.ts           — DCA / RSI / MACD / Grid executors
    bot-advisor.ts    — Claude strategy recommendation
    market-data.ts    — CoinGecko wrappers (all intervals)
    binance.ts        — authenticated live order placement
    db.ts             — Prisma client + getOwnerId()
    auth.ts           — AES-256-CBC key encryption
netlify/
  functions/
    scheduled-analysis.mts — every 30 min: proposals + bots
prisma/
  schema.prisma       — TradeProposal, Bot, SignalWeight, ProposalOutcome
```

---

## Running Locally

```bash
# install
npm install

# set up env
cp .env.example .env.local
# fill in DATABASE_URL, ENCRYPTION_KEY, ANTHROPIC_API_KEY

# push schema
npx prisma db push

# dev server
npm run dev

# tests (128 tests, ~1s)
npm test

# type check
npm run type-check
```

---

## AI Signal Indicators

| Indicator | Timeframe | What It Detects |
| --- | --- | --- |
| RSI(14) | 1H, 4H, 1D | Overbought / oversold |
| Stochastic RSI(14) | 1H | K/D crossover timing |
| MACD(12,26,9) | 4H | Zero-line cross + acceleration |
| Bollinger Bands(20,2) | 1H | Mean reversion + squeeze |
| EMA 20/50 | 4H | Golden / death cross |
| EMA 50/200 | 1D | Macro trend |
| Candlestick patterns | 1H | Hammer, Engulfing, Morning Star, Shooting Star |
| Order book imbalance | — | Bid/ask pressure (top 5 levels) |
| Volume surge | — | vs 24h baseline |
| Fear & Greed Index | — | Alternative.me (contrarian) |
| News sentiment | — | CryptoPanic vote ratio |
| ATR(14) | 1H | Dynamic stop loss at 1.5× ATR |
| ADX(14) | 4H | Trend strength filter |

Multi-timeframe alignment bonus: all 3 TFs agree → +20% to final score.

---

## Deployment

Push to `master` — GitHub Actions builds and deploys via Netlify CLI. Do **not** run `netlify deploy --build` locally on Windows (symlink EPERM).

Required Netlify env vars: `DATABASE_URL`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY`
