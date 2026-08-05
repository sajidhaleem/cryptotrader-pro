-- CreateTable
CREATE TABLE "PsxHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgBuyRate" DOUBLE PRECISION NOT NULL,
    "form" TEXT NOT NULL DEFAULT 'Physical',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsxHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PsxHolding_userId_symbol_key" ON "PsxHolding"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "PsxHolding" ADD CONSTRAINT "PsxHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
