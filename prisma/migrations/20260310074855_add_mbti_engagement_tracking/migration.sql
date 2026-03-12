-- CreateEnum
CREATE TYPE "MbtiEngagementEventType" AS ENUM ('PAGE_VIEW', 'RESULT_VIEWED', 'RESULT_SAVED');

-- CreateEnum
CREATE TYPE "MbtiTestMode" AS ENUM ('MINI', 'FULL');

-- CreateEnum
CREATE TYPE "SignupSource" AS ENUM ('DIRECT', 'MBTI_FREE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupSource" "SignupSource" NOT NULL DEFAULT 'DIRECT';

-- CreateTable
CREATE TABLE "MbtiEngagementEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "eventType" "MbtiEngagementEventType" NOT NULL,
    "testType" "MbtiTestMode",
    "mbtiType" "MbtiType",
    "pagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MbtiEngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_createdAt_idx" ON "MbtiEngagementEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_eventType_createdAt_idx" ON "MbtiEngagementEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_isAuthenticated_eventType_createdAt_idx" ON "MbtiEngagementEvent"("isAuthenticated", "eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_sessionId_createdAt_idx" ON "MbtiEngagementEvent"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_userId_createdAt_idx" ON "MbtiEngagementEvent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MbtiEngagementEvent_testType_eventType_createdAt_idx" ON "MbtiEngagementEvent"("testType", "eventType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MbtiEngagementEvent" ADD CONSTRAINT "MbtiEngagementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
