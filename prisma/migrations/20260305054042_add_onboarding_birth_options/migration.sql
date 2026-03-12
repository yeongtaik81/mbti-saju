-- CreateEnum
CREATE TYPE "BirthCalendarType" AS ENUM ('SOLAR', 'LUNAR');

-- CreateEnum
CREATE TYPE "BirthCountryType" AS ENUM ('KOREA', 'OTHER');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "birthCalendarType" "BirthCalendarType" NOT NULL DEFAULT 'SOLAR',
ADD COLUMN     "birthCountry" TEXT,
ADD COLUMN     "birthCountryType" "BirthCountryType" NOT NULL DEFAULT 'KOREA',
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "birthTime" TEXT,
ADD COLUMN     "isBirthTimeUnknown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLeapMonth" BOOLEAN NOT NULL DEFAULT false;
