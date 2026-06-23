import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateRecordValue } from "@/features/schema/value-validator";
import {
  type GenerateRecordInput,
  type GeneratedRecord,
  generateRecord,
} from "./record-generator";
import {
  type ClaimedGenerationJob,
  claimGenerationJob,
  claimNextGenerationJob,
} from "./job-repository";

type RecordGenerator = (input: GenerateRecordInput) => GeneratedRecord;

type RunGenerationJobOptions = {
  generateRecord?: RecordGenerator;
};

type RunGenerationJobResult =
  | {
      ok: true;
      jobId: string;
      status: "COMPLETED";
      promotedRecordCount: number;
    }
  | {
      ok: false;
      code: "JOB_NOT_PENDING";
    }
  | {
      ok: false;
      jobId: string;
      status: "FAILED";
    };

export async function runGenerationJob(
  jobId: string,
  options: RunGenerationJobOptions = {},
): Promise<RunGenerationJobResult> {
  const job = await claimGenerationJob(jobId);

  if (!job) {
    return { ok: false, code: "JOB_NOT_PENDING" };
  }

  return executeClaimedJob(job, options.generateRecord ?? generateRecord);
}

export async function runNextGenerationJob(
  options: RunGenerationJobOptions = {},
): Promise<RunGenerationJobResult | { ok: false; code: "NO_PENDING_JOB" }> {
  const job = await claimNextGenerationJob();

  if (!job) {
    return { ok: false, code: "NO_PENDING_JOB" };
  }

  return executeClaimedJob(job, options.generateRecord ?? generateRecord);
}

async function executeClaimedJob(
  job: ClaimedGenerationJob,
  generator: RecordGenerator,
): Promise<RunGenerationJobResult> {
  try {
    if (job.mode !== "FAKER_ONLY") {
      throw new Error("Hybrid LLM generation is not implemented yet");
    }

    await prisma.generatedRecordStage.deleteMany({ where: { jobId: job.id } });

    for (let ordinal = 0; ordinal < job.count; ordinal += 1) {
      const record = generator({
        schema: job.schema,
        seed: job.seed,
        ordinal,
        nullRate: job.nullRate,
      });
      const validation = validateRecordValue(job.schema, record.value);

      if (!validation.ok) {
        throw new Error(`Generated record is invalid: ${validation.errors.join("; ")}`);
      }

      await prisma.generatedRecordStage.create({
        data: {
          id: record.id,
          jobId: job.id,
          schemaVersionId: job.schemaVersionId,
          ordinal,
          value: record.value as Prisma.InputJsonValue,
        },
      });

      if ((ordinal + 1) % 100 === 0) {
        await heartbeat(job.id);
      }
    }

    return promoteGeneratedRecords(job);
  } catch {
    await failJob(job.id);

    return {
      ok: false,
      jobId: job.id,
      status: "FAILED",
    };
  }
}

async function promoteGeneratedRecords(
  job: ClaimedGenerationJob,
): Promise<Extract<RunGenerationJobResult, { ok: true }>> {
  return prisma.$transaction(async (transaction) => {
    const stagedRecords = await transaction.generatedRecordStage.findMany({
      where: { jobId: job.id },
      orderBy: { ordinal: "asc" },
      select: {
        id: true,
        ordinal: true,
        value: true,
      },
    });

    await transaction.mockRecord.deleteMany({
      where: { projectId: job.projectId },
    });
    if (stagedRecords.length > 0) {
      await transaction.mockRecord.createMany({
        data: stagedRecords.map((record) => ({
          id: record.id,
          projectId: job.projectId,
          schemaVersionId: job.schemaVersionId,
          generationJobId: job.id,
          ordinal: record.ordinal,
          source: "GENERATED",
          value: record.value as Prisma.InputJsonValue,
        })),
      });
    }
    await transaction.project.update({
      where: { id: job.projectId },
      data: { dataStatus: "COMPATIBLE" },
    });
    await transaction.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED" },
    });
    await transaction.auditEvent.create({
      data: {
        projectId: job.projectId,
        action: "DATA_GENERATED",
        metadata: {
          jobId: job.id,
          schemaVersionId: job.schemaVersionId,
          recordCount: stagedRecords.length,
          seed: job.seed,
          mode: job.mode,
        },
      },
    });

    return {
      ok: true,
      jobId: job.id,
      status: "COMPLETED",
      promotedRecordCount: stagedRecords.length,
    };
  });
}

async function heartbeat(jobId: string) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });
}

async function failJob(jobId: string) {
  await prisma.$transaction([
    prisma.generatedRecordStage.deleteMany({ where: { jobId } }),
    prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "FAILED" },
    }),
  ]);
}
