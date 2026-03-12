-- AlterTable
ALTER TABLE "SajuReading"
ADD COLUMN     "firstPartnerId" TEXT;

-- CreateIndex
CREATE INDEX "SajuReading_firstPartnerId_idx" ON "SajuReading"("firstPartnerId");

-- AddForeignKey
ALTER TABLE "SajuReading"
ADD CONSTRAINT "SajuReading_firstPartnerId_fkey"
FOREIGN KEY ("firstPartnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
