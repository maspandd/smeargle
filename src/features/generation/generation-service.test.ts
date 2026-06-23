import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/features/projects/project-service";
import { ForbiddenError } from "@/features/projects/authorization";
import { mutateSchema } from "@/features/schema/schema-service";
import { resetDatabase } from "../../../tests/helpers/database";
import { createGenerationJob } from "./generation-service";

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
  const owner = await createUser("generation-owner@example.test");
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

describe("generation service", () => {
  it("rejects a missing record count with the specified message", async () => {
    const { owner, project } = await createProjectWithSchema();

    await expect(
      createGenerationJob({
        actorId: owner.id,
        projectId: project.id,
        count: undefined,
        seed: "seed-123",
        nullRate: 0,
        mode: "FAKER_ONLY",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Please specify number of records",
    });
  });

  it.each([0, 10_001])("rejects count %s outside the allowed range", async (count) => {
    const { owner, project } = await createProjectWithSchema();

    await expect(
      createGenerationJob({
        actorId: owner.id,
        projectId: project.id,
        count,
        seed: "seed-123",
        nullRate: 0,
        mode: "FAKER_ONLY",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Record count must be between 1 and 10,000",
    });
  });

  it("rejects generation for an empty schema", async () => {
    const owner = await createUser("empty-schema-owner@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Empty API",
      baseEndpoint: "/api/empty",
    });

    await expect(
      createGenerationJob({
        actorId: owner.id,
        projectId: project.id,
        count: 10,
        seed: "seed-123",
        nullRate: 0,
        mode: "FAKER_ONLY",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Add at least one schema field before generating records",
    });
  });

  it("rejects a Viewer before creating a job", async () => {
    const { project } = await createProjectWithSchema();
    const viewer = await createUser("generation-viewer@example.test");
    await prisma.projectMembership.create({
      data: { projectId: project.id, userId: viewer.id, role: "VIEWER" },
    });

    await expect(
      createGenerationJob({
        actorId: viewer.id,
        projectId: project.id,
        count: 10,
        seed: "seed-123",
        nullRate: 0,
        mode: "FAKER_ONLY",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(prisma.generationJob.count()).resolves.toBe(0);
  });

  it("requires confirmation before replacing the existing dataset", async () => {
    const { owner, project, schemaVersion } = await createProjectWithSchema();
    await prisma.mockRecord.create({
      data: {
        id: "rec_existing",
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        ordinal: 0,
        source: "GENERATED",
        value: { product_name: "Old product" },
      },
    });

    await expect(
      createGenerationJob({
        actorId: owner.id,
        projectId: project.id,
        count: 10,
        seed: "seed-123",
        nullRate: 0,
        mode: "FAKER_ONLY",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "REPLACEMENT_CONFIRMATION_REQUIRED",
      existingRecordCount: 1,
    });
    await expect(prisma.generationJob.count()).resolves.toBe(0);
  });

  it("persists one pending job with the current schema version and effective seed", async () => {
    const { owner, project, schemaVersion } = await createProjectWithSchema();

    const result = await createGenerationJob({
      actorId: owner.id,
      projectId: project.id,
      count: 25,
      seed: "  ",
      nullRate: 0.2,
      mode: "FAKER_ONLY",
    });

    expect(result).toEqual({
      ok: true,
      jobId: expect.any(String),
      seed: expect.stringMatching(/^seed_[A-Za-z0-9_-]{20,}$/),
    });
    await expect(
      prisma.generationJob.findUniqueOrThrow({
        where: { id: result.ok ? result.jobId : "" },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        count: 25,
        seed: result.ok ? result.seed : "",
        nullRate: 0.2,
        mode: "FAKER_ONLY",
        status: "PENDING",
      }),
    );
  });
});
