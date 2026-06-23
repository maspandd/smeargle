-- AlterTable
ALTER TABLE "Project" ADD COLUMN "currentSchemaVersionId" TEXT;

-- CreateTable
CREATE TABLE "SchemaVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "actorId" TEXT,
    "restoredFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaVersion_pkey" PRIMARY KEY ("id")
);

-- Migrate existing projects to an initial schema snapshot.
INSERT INTO "SchemaVersion" (
    "id",
    "projectId",
    "major",
    "minor",
    "versionLabel",
    "snapshot",
    "changeSummary",
    "actorId",
    "createdAt"
)
SELECT
    'schema_' || "id",
    "id",
    "currentMajor",
    "currentMinor",
    'v' || "currentMajor" || '.' || "currentMinor",
    '{"fields":[]}'::jsonb,
    'Initial empty schema',
    NULL,
    "createdAt"
FROM "Project";

UPDATE "Project"
SET "currentSchemaVersionId" = 'schema_' || "id"
WHERE "currentSchemaVersionId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_currentSchemaVersionId_key" ON "Project"("currentSchemaVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaVersion_projectId_major_minor_key" ON "SchemaVersion"("projectId", "major", "minor");

-- CreateIndex
CREATE INDEX "SchemaVersion_projectId_idx" ON "SchemaVersion"("projectId");

-- CreateIndex
CREATE INDEX "SchemaVersion_actorId_idx" ON "SchemaVersion"("actorId");

-- CreateIndex
CREATE INDEX "SchemaVersion_restoredFromId_idx" ON "SchemaVersion"("restoredFromId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_currentSchemaVersionId_fkey" FOREIGN KEY ("currentSchemaVersionId") REFERENCES "SchemaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaVersion" ADD CONSTRAINT "SchemaVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaVersion" ADD CONSTRAINT "SchemaVersion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaVersion" ADD CONSTRAINT "SchemaVersion_restoredFromId_fkey" FOREIGN KEY ("restoredFromId") REFERENCES "SchemaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
