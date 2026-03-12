-- AlterTable
ALTER TABLE "PartnerProfile"
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "birthTime" TEXT,
ADD COLUMN     "isBirthTimeUnknown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "birthCalendarType" "BirthCalendarType" NOT NULL DEFAULT 'SOLAR',
ADD COLUMN     "isLeapMonth" BOOLEAN NOT NULL DEFAULT false;
