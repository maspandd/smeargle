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
import {
  enrichGeneratedRecords,
  type EnrichmentSummary,
} from "./enrichment-service";
import type { LlmProvider } from "./llm-provider";

type RecordGenerator = (input: GenerateRecordInput) => GeneratedRecord;

type RunGenerationJobOptions = {
  generateRecord?: RecordGenerator;
  llmProvider?: LlmProvider;
  enrichment?: {
    batchSize?: number;
    timeoutMs?: number;
    maxRetries?: number;
  };
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

  return executeClaimedJob(job, {
    generator: options.generateRecord ?? generateRecord,
    llmProvider: options.llmProvider,
    enrichment: options.enrichment,
  });
}

export async function runNextGenerationJob(
  options: RunGenerationJobOptions = {},
): Promise<RunGenerationJobResult | { ok: false; code: "NO_PENDING_JOB" }> {
  const job = await claimNextGenerationJob();

  if (!job) {
    return { ok: false, code: "NO_PENDING_JOB" };
  }

  return executeClaimedJob(job, {
    generator: options.generateRecord ?? generateRecord,
    llmProvider: options.llmProvider,
    enrichment: options.enrichment,
  });
}

async function executeClaimedJob(
  job: ClaimedGenerationJob,
  options: {
    generator: RecordGenerator;
    llmProvider?: LlmProvider;
    enrichment?: RunGenerationJobOptions["enrichment"];
  },
): Promise<RunGenerationJobResult> {
  try {
    await prisma.generatedRecordStage.deleteMany({ where: { jobId: job.id } });
    const generatedRecords: GeneratedRecord[] = [];

    for (let ordinal = 0; ordinal < job.count; ordinal += 1) {
      const record = options.generator({
        schema: job.schema,
        seed: job.seed,
        ordinal,
        nullRate: job.nullRate,
      });
      const validation = validateRecordValue(job.schema, record.value);

      if (!validation.ok) {
        throw new Error(`Generated record is invalid: ${validation.errors.join("; ")}`);
      }

      generatedRecords.push(record);

      if ((ordinal + 1) % 100 === 0) {
        await heartbeat(job.id);
      }
    }

    const { records, warningSummary } = await enrichHybridRecords(
      job,
      generatedRecords,
      options,
    );

    for (let ordinal = 0; ordinal < records.length; ordinal += 1) {
      const record = records[ordinal];

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

    return promoteGeneratedRecords(job, warningSummary);
  } catch {
    await failJob(job.id);

    return {
      ok: false,
      jobId: job.id,
      status: "FAILED",
    };
  }
}

async function enrichHybridRecords(
  job: ClaimedGenerationJob,
  records: GeneratedRecord[],
  options: {
    llmProvider?: LlmProvider;
    enrichment?: RunGenerationJobOptions["enrichment"];
  },
): Promise<{
  records: GeneratedRecord[];
  warningSummary?: EnrichmentSummary;
}> {
  if (job.mode === "FAKER_ONLY") {
    return { records };
  }

  if (!options.llmProvider) {
    throw new Error("Hybrid generation requires an LLM provider");
  }

  const enriched = await enrichGeneratedRecords({
    schema: job.schema,
    records,
    provider: options.llmProvider,
    ...options.enrichment,
  });

  return {
    records: enriched.records,
    warningSummary: enriched.summary,
  };
}

async function promoteGeneratedRecords(
  job: ClaimedGenerationJob,
  warningSummary?: EnrichmentSummary,
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
      data: {
        status: "COMPLETED",
        warningSummary: warningSummary as Prisma.InputJsonValue | undefined,
      },
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
          ...(warningSummary ? { warningSummary } : {}),
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
