-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('FAKER_ONLY', 'HYBRID_LLM');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('GENERATED');

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemaVersionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "nullRate" DOUBLE PRECISION NOT NULL,
    "mode" "GenerationMode" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedRecordStage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "schemaVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedRecordStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemaVersionId" TEXT NOT NULL,
    "generationJobId" TEXT,
    "ordinal" INTEGER NOT NULL,
    "source" "RecordSource" NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationJob_projectId_id_idx" ON "GenerationJob"("projectId", "id");

-- CreateIndex
CREATE INDEX "GenerationJob_schemaVersionId_idx" ON "GenerationJob"("schemaVersionId");

-- CreateIndex
CREATE INDEX "GeneratedRecordStage_jobId_ordinal_idx" ON "GeneratedRecordStage"("jobId", "ordinal");

-- CreateIndex
CREATE INDEX "GeneratedRecordStage_schemaVersionId_idx" ON "GeneratedRecordStage"("schemaVersionId");

-- CreateIndex
CREATE INDEX "MockRecord_projectId_id_idx" ON "MockRecord"("projectId", "id");

-- CreateIndex
CREATE INDEX "MockRecord_projectId_ordinal_idx" ON "MockRecord"("projectId", "ordinal");

-- CreateIndex
CREATE INDEX "MockRecord_schemaVersionId_idx" ON "MockRecord"("schemaVersionId");

-- CreateIndex
CREATE INDEX "MockRecord_generationJobId_idx" ON "MockRecord"("generationJobId");

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_schemaVersionId_fkey" FOREIGN KEY ("schemaVersionId") REFERENCES "SchemaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedRecordStage" ADD CONSTRAINT "GeneratedRecordStage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedRecordStage" ADD CONSTRAINT "GeneratedRecordStage_schemaVersionId_fkey" FOREIGN KEY ("schemaVersionId") REFERENCES "SchemaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRecord" ADD CONSTRAINT "MockRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRecord" ADD CONSTRAINT "MockRecord_schemaVersionId_fkey" FOREIGN KEY ("schemaVersionId") REFERENCES "SchemaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRecord" ADD CONSTRAINT "MockRecord_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
