import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/features/projects/project-service";
import type { GenerationRequest } from "@/features/generation/job-types";
import { resetDatabase } from "../helpers/database";

afterEach(resetDatabase);

async function createOwnerProject() {
  const owner = await prisma.user.create({
    data: { email: "generation-owner@example.test", passwordHash: "hash" },
  });
  const project = await createProject({
    actorId: owner.id,
    name: "Products API",
    baseEndpoint: "/api/products",
  });
  const schemaVersion = await prisma.project
    .findUniqueOrThrow({
      where: { id: project.id },
      select: { currentSchemaVersion: true },
    })
    .then((record) => record.currentSchemaVersion!);

  return { owner, project, schemaVersion };
}

describe("generation persistence", () => {
  it("stages generated records without changing the current project records", async () => {
    const { project, schemaVersion } = await createOwnerProject();
    const request: GenerationRequest = {
      projectId: project.id,
      schemaVersionId: schemaVersion.id,
      count: 2,
      seed: "seed-123",
      nullRate: 0.15,
      mode: "FAKER_ONLY",
    };
    const existingRecord = await prisma.mockRecord.create({
      data: {
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        ordinal: 0,
        source: "GENERATED",
        value: { id: "existing", name: "Current product" },
      },
    });

    const job = await prisma.generationJob.create({
      data: request,
    });
    await prisma.generatedRecordStage.createMany({
      data: [
        {
          jobId: job.id,
          schemaVersionId: schemaVersion.id,
          ordinal: 0,
          value: { id: "staged-1", name: "Staged product 1" },
        },
        {
          jobId: job.id,
          schemaVersionId: schemaVersion.id,
          ordinal: 1,
          value: { id: "staged-2", name: "Staged product 2" },
        },
      ],
    });

    await expect(
      prisma.generatedRecordStage.count({ where: { jobId: job.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.mockRecord.findMany({
        where: { projectId: project.id },
        orderBy: { ordinal: "asc" },
      }),
    ).resolves.toEqual([existingRecord]);
  });

  it("prevents deleting a schema version while jobs or records still reference it", async () => {
    const { project, schemaVersion } = await createOwnerProject();
    const job = await prisma.generationJob.create({
      data: {
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        count: 1,
        seed: "seed-locked",
        nullRate: 0,
        mode: "FAKER_ONLY",
      },
    });
    await prisma.generatedRecordStage.create({
      data: {
        jobId: job.id,
        schemaVersionId: schemaVersion.id,
        ordinal: 0,
        value: { id: "staged-locked" },
      },
    });
    await prisma.mockRecord.create({
      data: {
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        generationJobId: job.id,
        ordinal: 0,
        source: "GENERATED",
        value: { id: "current-locked" },
      },
    });

    await expect(
      prisma.schemaVersion.delete({ where: { id: schemaVersion.id } }),
    ).rejects.toThrow();
  });
});
