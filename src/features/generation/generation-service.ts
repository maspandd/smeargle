import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireProjectCapability } from "@/features/projects/authorization";
import type { SchemaSnapshot } from "@/features/schema/schema-types";

type GenerationMode = "FAKER_ONLY" | "HYBRID_LLM";

type CreateGenerationJobInput = {
  actorId: string;
  projectId: string;
  count?: number;
  seed?: string;
  nullRate?: number;
  mode?: GenerationMode;
  confirmedReplacement?: boolean;
};

type CreateGenerationJobResult =
  | {
      ok: true;
      jobId: string;
      seed: string;
    }
  | {
      ok: false;
      code: "VALIDATION_ERROR";
      message: string;
    }
  | {
      ok: false;
      code: "REPLACEMENT_CONFIRMATION_REQUIRED";
      existingRecordCount: number;
    };

export async function createGenerationJob(
  input: CreateGenerationJobInput,
): Promise<CreateGenerationJobResult> {
  const countValidation = validateCount(input.count);

  if (countValidation) {
    return countValidation;
  }

  const nullRate = input.nullRate ?? 0;
  const nullRateValidation = validateNullRate(nullRate);

  if (nullRateValidation) {
    return nullRateValidation;
  }

  const mode = input.mode ?? "FAKER_ONLY";
  const modeValidation = validateMode(mode);

  if (modeValidation) {
    return modeValidation;
  }

  await requireProjectCapability({
    userId: input.actorId,
    projectId: input.projectId,
    capability: "mutate_records",
  });

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: {
        currentSchemaVersion: {
          select: {
            id: true,
            snapshot: true,
          },
        },
      },
    });

    if (!project.currentSchemaVersion) {
      return validationError("Add at least one schema field before generating records");
    }

    const snapshot = project.currentSchemaVersion.snapshot as SchemaSnapshot;

    if (snapshot.fields.length === 0) {
      return validationError("Add at least one schema field before generating records");
    }

    const existingRecordCount = await transaction.mockRecord.count({
      where: { projectId: input.projectId },
    });

    if (existingRecordCount > 0 && !input.confirmedReplacement) {
      return {
        ok: false,
        code: "REPLACEMENT_CONFIRMATION_REQUIRED",
        existingRecordCount,
      };
    }

    const effectiveSeed = normalizeSeed(input.seed);
    const job = await transaction.generationJob.create({
      data: {
        projectId: input.projectId,
        schemaVersionId: project.currentSchemaVersion.id,
        count: input.count!,
        seed: effectiveSeed,
        nullRate,
        mode,
      },
    });

    return {
      ok: true,
      jobId: job.id,
      seed: effectiveSeed,
    };
  });
}

function validateCount(
  count: number | undefined,
): Extract<CreateGenerationJobResult, { code: "VALIDATION_ERROR" }> | undefined {
  if (count === undefined || Number.isNaN(count)) {
    return validationError("Please specify number of records");
  }
  if (!Number.isInteger(count) || count < 1 || count > 10_000) {
    return validationError("Record count must be between 1 and 10,000");
  }

  return undefined;
}

function validateNullRate(
  nullRate: number,
): Extract<CreateGenerationJobResult, { code: "VALIDATION_ERROR" }> | undefined {
  if (!Number.isFinite(nullRate) || nullRate < 0 || nullRate > 1) {
    return validationError("Null rate must be between 0 and 1");
  }

  return undefined;
}

function validateMode(
  mode: string,
): Extract<CreateGenerationJobResult, { code: "VALIDATION_ERROR" }> | undefined {
  if (mode !== "FAKER_ONLY" && mode !== "HYBRID_LLM") {
    return validationError("Generation mode is not supported");
  }

  return undefined;
}

function normalizeSeed(seed: string | undefined) {
  const trimmedSeed = seed?.trim();

  return trimmedSeed && trimmedSeed.length > 0
    ? trimmedSeed
    : `seed_${randomBytes(18).toString("base64url")}`;
}

function validationError(
  message: string,
): Extract<CreateGenerationJobResult, { code: "VALIDATION_ERROR" }> {
  return { ok: false, code: "VALIDATION_ERROR", message };
}
