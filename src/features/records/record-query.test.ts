import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/features/projects/project-service";
import { ForbiddenError } from "@/features/projects/authorization";
import { mutateSchema } from "@/features/schema/schema-service";
import { resetDatabase } from "../../../tests/helpers/database";
import { queryRecords } from "./record-query";

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
  const owner = await createUser("query-owner@example.test");
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

  if (!result.ok) throw new Error("Mutation failed");

  return { owner, project, schemaVersion: result.version };
}

describe("record query", () => {
  it("paginates with page bounds, stable record ordering, and total count", async () => {
    const { owner, project, schemaVersion } = await createProjectWithSchema();

    // Create 15 records
    await prisma.mockRecord.createMany({
      data: Array.from({ length: 15 }, (_, i) => ({
        id: `rec_${i.toString().padStart(3, "0")}`,
        projectId: project.id,
        schemaVersionId: schemaVersion.id,
        ordinal: i,
        source: "GENERATED",
        value: { product_name: `Product ${i}` },
      })),
    });

    const page1 = await queryRecords({
      actorId: owner.id,
      projectId: project.id,
      page: 1,
      pageSize: 10,
    });

    expect(page1.totalCount).toBe(15);
    expect(page1.records).toHaveLength(10);
    expect(page1.records[0].id).toBe("rec_000");
    expect(page1.records[9].id).toBe("rec_009");

    const page2 = await queryRecords({
      actorId: owner.id,
      projectId: project.id,
      page: 2,
      pageSize: 10,
    });

    expect(page2.totalCount).toBe(15);
    expect(page2.records).toHaveLength(5);
    expect(page2.records[0].id).toBe("rec_010");
    expect(page2.records[4].id).toBe("rec_014");

    const page3 = await queryRecords({
      actorId: owner.id,
      projectId: project.id,
      page: 3,
      pageSize: 10,
    });

    expect(page3.totalCount).toBe(15);
    expect(page3.records).toHaveLength(0);
  });

  it("allows Viewer access", async () => {
    const { project } = await createProjectWithSchema();
    const viewer = await createUser("viewer@example.test");
    await prisma.projectMembership.create({
      data: { projectId: project.id, userId: viewer.id, role: "VIEWER" },
    });

    await expect(
      queryRecords({
        actorId: viewer.id,
        projectId: project.id,
        page: 1,
        pageSize: 10,
      })
    ).resolves.toMatchObject({ totalCount: 0, records: [] });
  });

  it("denies access for unauthorized user", async () => {
    const { project } = await createProjectWithSchema();
    const stranger = await createUser("stranger@example.test");

    await expect(
      queryRecords({
        actorId: stranger.id,
        projectId: project.id,
        page: 1,
        pageSize: 10,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
