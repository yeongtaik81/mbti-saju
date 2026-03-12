-- CreateTable
CREATE TABLE "AdminWalletAdjustment" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWalletAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminWalletAdjustment_adminUserId_createdAt_idx" ON "AdminWalletAdjustment"("adminUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminWalletAdjustment_targetUserId_createdAt_idx" ON "AdminWalletAdjustment"("targetUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AdminWalletAdjustment" ADD CONSTRAINT "AdminWalletAdjustment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWalletAdjustment" ADD CONSTRAINT "AdminWalletAdjustment_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
