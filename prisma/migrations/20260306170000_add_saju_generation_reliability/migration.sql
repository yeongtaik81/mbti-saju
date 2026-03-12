DO $$
BEGIN
  CREATE TYPE "ReadingCacheScope" AS ENUM ('STATIC', 'YEARLY', 'MONTHLY', 'DAILY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GenerationFailureStage" AS ENUM (
    'RULE_DRAFT',
    'LLM_RENDER',
    'CODE_VALIDATE',
    'LLM_REVIEW',
    'FINAL_GUARD',
    'PERSIST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SajuResultCache"
  ADD COLUMN IF NOT EXISTS "scope" "ReadingCacheScope",
  ADD COLUMN IF NOT EXISTS "periodKey" TEXT,
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

CREATE INDEX IF NOT EXISTS "SajuResultCache_scope_periodKey_idx"
  ON "SajuResultCache"("scope", "periodKey");

CREATE TABLE IF NOT EXISTS "SajuGenerationFailure" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readingType" "ReadingType" NOT NULL,
  "subjectType" TEXT NOT NULL,
  "cacheKey" TEXT,
  "periodScope" "ReadingCacheScope",
  "periodKey" TEXT,
  "stage" "GenerationFailureStage" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reasonMessage" TEXT NOT NULL,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SajuGenerationFailure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SajuGenerationFailure_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SajuGenerationFailure_userId_createdAt_idx"
  ON "SajuGenerationFailure"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SajuGenerationFailure_cacheKey_idx"
  ON "SajuGenerationFailure"("cacheKey");

CREATE INDEX IF NOT EXISTS "SajuGenerationFailure_stage_createdAt_idx"
  ON "SajuGenerationFailure"("stage", "createdAt" DESC);
