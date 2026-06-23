import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/features/projects/project-service";
import { mutateSchema } from "@/features/schema/schema-service";
import { resetDatabase } from "../helpers/database";

afterEach(resetDatabase);

async function createOwnerProject() {
  const owner = await prisma.user.create({
    data: { email: "owner@example.test", passwordHash: "hash" },
  });
  const project = await createProject({
    actorId: owner.id,
    name: "Products API",
    baseEndpoint: "/api/products",
  });
  const version = await prisma.project
    .findUniqueOrThrow({
      where: { id: project.id },
      select: { currentSchemaVersion: true },
    })
    .then((record) => record.currentSchemaVersion!);

  return { owner, project, version };
}

describe("schema mutation transaction", () => {
  it("creates one version, updates the project pointer, and appends one audit event", async () => {
    const { owner, project, version } = await createOwnerProject();

    const result = await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: version.id,
      mutation: {
        type: "addField",
        parentFieldPath: [],
        field: {
          id: "fld_product_name",
          name: "product_name",
          type: "string",
          required: true,
        },
      },
    });

    expect(result.ok).toBe(true);
    const persisted = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: {
        currentSchemaVersionId: true,
        currentSchemaVersion: true,
      },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: { projectId: project.id, action: "SCHEMA_MUTATED" },
    });

    expect(persisted.currentSchemaVersionId).toBe(
      result.ok ? result.version.id : undefined,
    );
    expect(persisted.currentSchemaVersion?.versionLabel).toBe("v1.1");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: owner.id,
        metadata: expect.objectContaining({
          versionLabel: "v1.1",
          mutationType: "addField",
        }),
      }),
    ]);
  });

  it("rolls back version and audit rows when validation fails", async () => {
    const { owner, project, version } = await createOwnerProject();

    await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: version.id,
      mutation: {
        type: "addField",
        parentFieldPath: [],
        field: {
          id: "fld_product_name",
          name: "product_name",
          type: "string",
          required: true,
        },
      },
    });
    const current = await prisma.project
      .findUniqueOrThrow({
        where: { id: project.id },
        select: { currentSchemaVersion: true },
      })
      .then((record) => record.currentSchemaVersion!);

    await expect(
      mutateSchema({
        actorId: owner.id,
        projectId: project.id,
        expectedVersionId: current.id,
        mutation: {
          type: "addField",
          parentFieldPath: [],
          field: {
            id: "fld_duplicate",
            name: "product_name",
            type: "number",
            required: false,
          },
        },
      }),
    ).rejects.toThrow(/Duplicate field name/);

    await expect(
      prisma.schemaVersion.count({ where: { projectId: project.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.auditEvent.count({
        where: { projectId: project.id, action: "SCHEMA_MUTATED" },
      }),
    ).resolves.toBe(1);
  });
});
