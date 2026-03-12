-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MbtiType" AS ENUM ('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP');

-- CreateEnum
CREATE TYPE "MbtiSourceType" AS ENUM ('DIRECT', 'MINI_TEST', 'FULL_TEST');

-- CreateEnum
CREATE TYPE "ReadingType" AS ENUM ('SELF', 'COMPATIBILITY');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('CHARGED', 'SKIPPED_DUPLICATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDateTime" TIMESTAMP(3) NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MbtiProfile" (
    "userId" TEXT NOT NULL,
    "mbtiType" "MbtiType" NOT NULL,
    "sourceType" "MbtiSourceType" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MbtiProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SajuItemWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SajuItemWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SajuResultCache" (
    "cacheKey" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SajuResultCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "SajuResultCacheHit" (
    "cacheKey" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SajuResultCacheHit_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDateTime" TIMESTAMP(3) NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "mbtiType" "MbtiType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SajuReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readingType" "ReadingType" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "partnerId" TEXT,
    "cacheKey" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "chargeStatus" "ChargeStatus" NOT NULL,
    "itemCost" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SajuReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SajuReadingResult" (
    "readingId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SajuReadingResult_pkey" PRIMARY KEY ("readingId")
);

-- CreateTable
CREATE TABLE "MockPaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PartnerProfile_ownerUserId_idx" ON "PartnerProfile"("ownerUserId");

-- CreateIndex
CREATE INDEX "SajuReading_userId_createdAt_idx" ON "SajuReading"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SajuReading_userId_cacheKey_key" ON "SajuReading"("userId", "cacheKey");

-- CreateIndex
CREATE INDEX "MockPaymentTransaction_userId_createdAt_idx" ON "MockPaymentTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MockPaymentTransaction_userId_idempotencyKey_key" ON "MockPaymentTransaction"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MbtiProfile" ADD CONSTRAINT "MbtiProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuItemWallet" ADD CONSTRAINT "SajuItemWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuResultCacheHit" ADD CONSTRAINT "SajuResultCacheHit_cacheKey_fkey" FOREIGN KEY ("cacheKey") REFERENCES "SajuResultCache"("cacheKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuReading" ADD CONSTRAINT "SajuReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuReading" ADD CONSTRAINT "SajuReading_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuReading" ADD CONSTRAINT "SajuReading_cacheKey_fkey" FOREIGN KEY ("cacheKey") REFERENCES "SajuResultCache"("cacheKey") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SajuReadingResult" ADD CONSTRAINT "SajuReadingResult_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "SajuReading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockPaymentTransaction" ADD CONSTRAINT "MockPaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
