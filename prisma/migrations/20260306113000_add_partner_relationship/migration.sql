-- Add optional relationship field for partner profiles
ALTER TABLE "PartnerProfile"
ADD COLUMN "relationship" TEXT;
