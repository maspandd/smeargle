-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "corsOrigins" TEXT[] DEFAULT ARRAY['*']::TEXT[],
ADD COLUMN     "rateLimit" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
