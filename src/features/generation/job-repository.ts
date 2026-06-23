import type { GenerationMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SchemaSnapshot } from "@/features/schema/schema-types";

export type ClaimedGenerationJob = {
  id: string;
  projectId: string;
  schemaVersionId: string;
  count: number;
  seed: string;
  nullRate: number;
  mode: GenerationMode;
  schema: SchemaSnapshot;
};

export async function claimNextGenerationJob(): Promise<ClaimedGenerationJob | null> {
  const pendingJob = await prisma.generationJob.findFirst({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (!pendingJob) {
    return null;
  }

  return claimGenerationJob(pendingJob.id);
}

export async function claimGenerationJob(
  jobId: string,
): Promise<ClaimedGenerationJob | null> {
  const claimed = await prisma.generationJob.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "RUNNING" },
  });

  if (claimed.count === 0) {
    return null;
  }

  return prisma.generationJob
    .findUniqueOrThrow({
      where: { id: jobId },
      select: {
        id: true,
        projectId: true,
        schemaVersionId: true,
        count: true,
        seed: true,
        nullRate: true,
        mode: true,
        schemaVersion: {
          select: { snapshot: true },
        },
      },
    })
    .then((job) => ({
      id: job.id,
      projectId: job.projectId,
      schemaVersionId: job.schemaVersionId,
      count: job.count,
      seed: job.seed,
      nullRate: job.nullRate,
      mode: job.mode,
      schema: job.schemaVersion.snapshot as SchemaSnapshot,
    }));
}
