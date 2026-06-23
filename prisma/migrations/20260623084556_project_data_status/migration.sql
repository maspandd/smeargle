-- CreateEnum
CREATE TYPE "ProjectDataStatus" AS ENUM ('EMPTY', 'COMPATIBLE', 'INCOMPATIBLE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dataStatus" "ProjectDataStatus" NOT NULL DEFAULT 'EMPTY';
