import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/features/projects/project-service";
import { mutateSchema } from "@/features/schema/schema-service";
import { validateRecordValue } from "@/features/schema/value-validator";
import { createGenerationJob } from "@/features/generation/generation-service";
import { FakeLlmProvider } from "@/features/generation/fake-llm-provider";
import { generateRecord } from "@/features/generation/record-generator";
import { claimNextGenerationJob } from "@/features/generation/job-repository";
import { runGenerationJob } from "@/features/generation/job-runner";
import { LlmProviderError } from "@/features/generation/llm-provider";
import { resetDatabase } from "../helpers/database";

afterEach(resetDatabase);

async function createUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "hash" },
  });
}

async function currentVersion(projectId: string) {
  return prisma.project
    .findUniqueOrThrow({
      where: { id: projectId },
      select: { currentSchemaVersion: true },
    })
    .then((project) => project.currentSchemaVersion!);
}

async function createProjectWithSchema() {
  const owner = await createUser("generation-job-owner@example.test");
  const project = await createProject({
    actorId: owner.id,
    name: "Products API",
    baseEndpoint: "/api/products",
  });
  const initialVersion = await currentVersion(project.id);
  const result = await mutateSchema({
    actorId: owner.id,
    projectId: project.id,
    expectedVersionId: initialVersion.id,
    mutation: {
      type: "addField",
      parentFieldPath: [],
      field: {
        id: "fld_product_name",
        name: "product_name",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 40,
      },
    },
  });

  if (!result.ok) {
    throw new Error("Expected schema mutation to succeed");
  }

  return { owner, project, schemaVersion: result.version };
}

async function createProjectWithSemanticSchema() {
  const fixture = await createProjectWithSchema();
  const result = await mutateSchema({
    actorId: fixture.owner.id,
    projectId: fixture.project.id,
    expectedVersionId: fixture.schemaVersion.id,
    mutation: {
      type: "addField",
      parentFieldPath: [],
      field: {
        id: "fld_customer_email",
        name: "customer_email",
        type: "email",
        required: true,
      },
    },
  });

  if (!result.ok) {
    throw new Error("Expected semantic schema mutation to succeed");
  }

  return { ...fixture, schemaVersion: result.version };
}

async function createPendingGenerationJob(input?: {
  count?: number;
  seed?: string;
  confirmedReplacement?: boolean;
}) {
  const fixture = await createProjectWithSchema();
  const result = await createGenerationJob({
    actorId: fixture.owner.id,
    projectId: fixture.project.id,
    count: input?.count ?? 3,
    seed: input?.seed ?? "runner-seed",
    nullRate: 0,
    mode: "FAKER_ONLY",
    confirmedReplacement: input?.confirmedReplacement,
  });

  if (!result.ok) {
    throw new Error(`Expected generation job creation to succeed, got ${result.code}`);
  }

  return { ...fixture, jobId: result.jobId, seed: result.seed };
}

describe("generation jobs", () => {
  it("claims exactly one runner for one pending job", async () => {
    const { jobId } = await createPendingGenerationJob({ count: 2 });

    const [firstClaim, secondClaim] = await Promise.all([
      claimNextGenerationJob(),
      claimNextGenerationJob(),
    ]);
    const claimed = [firstClaim, secondClaim].filter(Boolean);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe(jobId);
    await expect(
      prisma.generationJob.findUniqueOrThrow({
        where: { id: jobId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "RUNNING" });
  });

  it("runs a faker-only job and atomically promotes generated records", async () => {
    const { owner, project, schemaVersion } = await createProjectWithSchema();
    await prisma.mockRecord.create({
      data: {
        id: "rec_old",
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        ordinal: 0,
        source: "GENERATED",
        value: { product_name: "Old product" },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { dataStatus: "INCOMPATIBLE" },
    });
    const created = await createGenerationJob({
      actorId: owner.id,
      projectId: project.id,
      count: 3,
      seed: "promotion-seed",
      nullRate: 0,
      mode: "FAKER_ONLY",
      confirmedReplacement: true,
    });

    if (!created.ok) {
      throw new Error(`Expected job creation to succeed, got ${created.code}`);
    }

    await expect(runGenerationJob(created.jobId)).resolves.toEqual({
      ok: true,
      jobId: created.jobId,
      status: "COMPLETED",
      promotedRecordCount: 3,
    });

    const records = await prisma.mockRecord.findMany({
      where: { projectId: project.id },
      orderBy: { ordinal: "asc" },
    });
    const currentProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: { dataStatus: true },
    });
    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: created.jobId },
      select: { status: true },
    });
    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: { projectId: project.id, action: "DATA_GENERATED" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });

    expect(records).toHaveLength(3);
    expect(records.map((record) => record.ordinal)).toEqual([0, 1, 2]);
    expect(records.map((record) => record.id)).not.toContain("rec_old");
    for (const record of records) {
      expect(record.id).toMatch(/^rec_[A-Za-z0-9_-]{20,}$/);
      expect(validateRecordValue(schemaVersion.snapshot, record.value)).toEqual({
        ok: true,
        errors: [],
      });
    }
    expect(currentProject.dataStatus).toBe("COMPATIBLE");
    expect(job.status).toBe("COMPLETED");
    expect(auditEvent.metadata).toEqual(
      expect.objectContaining({
        jobId: created.jobId,
        recordCount: 3,
        seed: "promotion-seed",
      }),
    );
    await expect(
      prisma.generatedRecordStage.count({ where: { jobId: created.jobId } }),
    ).resolves.toBe(3);
  });

  it("does not promote a completed job a second time", async () => {
    const { project, jobId } = await createPendingGenerationJob({
      count: 2,
      seed: "idempotent-seed",
    });

    await runGenerationJob(jobId);
    const promotedBefore = await prisma.mockRecord.findMany({
      where: { projectId: project.id },
      orderBy: { ordinal: "asc" },
    });

    await expect(runGenerationJob(jobId)).resolves.toEqual({
      ok: false,
      code: "JOB_NOT_PENDING",
    });
    await expect(
      prisma.mockRecord.findMany({
        where: { projectId: project.id },
        orderBy: { ordinal: "asc" },
      }),
    ).resolves.toEqual(promotedBefore);
  });

  it("marks the job failed and preserves old data when generation throws", async () => {
    const { owner, project, schemaVersion } = await createProjectWithSchema();
    await prisma.mockRecord.create({
      data: {
        id: "rec_existing_failure",
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        ordinal: 0,
        source: "GENERATED",
        value: { product_name: "Still current" },
      },
    });
    const created = await createGenerationJob({
      actorId: owner.id,
      projectId: project.id,
      count: 2,
      seed: "failure-seed",
      nullRate: 0,
      mode: "FAKER_ONLY",
      confirmedReplacement: true,
    });

    if (!created.ok) {
      throw new Error(`Expected job creation to succeed, got ${created.code}`);
    }

    await expect(
      runGenerationJob(created.jobId, {
        generateRecord(input) {
          if (input.ordinal === 1) {
            throw new Error("Injected generation failure");
          }

          return generateRecord(input);
        },
      }),
    ).resolves.toEqual({
      ok: false,
      jobId: created.jobId,
      status: "FAILED",
    });

    await expect(
      prisma.generationJob.findUniqueOrThrow({
        where: { id: created.jobId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "FAILED" });
    await expect(
      prisma.generatedRecordStage.count({ where: { jobId: created.jobId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.mockRecord.findMany({
        where: { projectId: project.id },
        orderBy: { ordinal: "asc" },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "rec_existing_failure",
        value: { product_name: "Still current" },
      }),
    ]);
  });

  it("completes a hybrid job with faker fallback and stores its warning summary", async () => {
    const { owner, project } = await createProjectWithSemanticSchema();
    const created = await createGenerationJob({
      actorId: owner.id,
      projectId: project.id,
      count: 2,
      seed: "hybrid-fallback-seed",
      nullRate: 0,
      mode: "HYBRID_LLM",
    });
    const provider = new FakeLlmProvider(async () => {
      throw new LlmProviderError("Provider quota exceeded", {
        code: "QUOTA_EXCEEDED",
        transient: false,
      });
    });

    if (!created.ok) {
      throw new Error(`Expected job creation to succeed, got ${created.code}`);
    }

    await expect(
      runGenerationJob(created.jobId, { llmProvider: provider }),
    ).resolves.toEqual({
      ok: true,
      jobId: created.jobId,
      status: "COMPLETED",
      promotedRecordCount: 2,
    });

    const records = await prisma.mockRecord.findMany({
      where: { projectId: project.id },
      orderBy: { ordinal: "asc" },
      select: { value: true },
    });
    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: created.jobId },
      select: { status: true, warningSummary: true },
    });

    expect(provider.requests).toHaveLength(1);
    expect(records).toEqual([
      {
        value: expect.objectContaining({
          customer_email: expect.stringMatching(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          ),
        }),
      },
      {
        value: expect.objectContaining({
          customer_email: expect.stringMatching(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          ),
        }),
      },
    ]);
    expect(job).toEqual({
      status: "COMPLETED",
      warningSummary: {
        requested: 2,
        enriched: 0,
        fallback: 2,
        failedBatches: 1,
      },
    });
  });
});
