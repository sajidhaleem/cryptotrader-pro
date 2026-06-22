-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ProposalOutcome" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN');

-- CreateEnum
CREATE TYPE "TradeMode" AS ENUM ('PAPER', 'LIVE');

-- AlterTable
ALTER TABLE "PaperTrade" ADD COLUMN     "proposalId" TEXT;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "proposalId" TEXT;

-- CreateTable
CREATE TABLE "TradeProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "ProposalOutcome",
    "pnl" DOUBLE PRECISION,
    "mode" "TradeMode" NOT NULL DEFAULT 'PAPER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalWeight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "change24h" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "fearGreed" INTEGER,
    "sentiment" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "bbUpper" DOUBLE PRECISION,
    "bbLower" DOUBLE PRECISION,
    "bbMid" DOUBLE PRECISION,
    "signal" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalWeight_userId_indicator_key" ON "SignalWeight"("userId", "indicator");

-- CreateIndex
CREATE INDEX "MarketSnapshot_symbol_createdAt_idx" ON "MarketSnapshot"("symbol", "createdAt");

-- AddForeignKey
ALTER TABLE "TradeProposal" ADD CONSTRAINT "TradeProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalWeight" ADD CONSTRAINT "SignalWeight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
