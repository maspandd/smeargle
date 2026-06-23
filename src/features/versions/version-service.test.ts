import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { createProject } from "../projects/project-service";
import { createSchemaVersion } from "./version-service";

afterEach(resetDatabase);

describe("schema version persistence", () => {
  it("creates an immutable v1.0 empty snapshot when a project is created", async () => {
    const owner = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });

    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });

    const persisted = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        currentSchemaVersion: true,
        schemaVersions: { orderBy: { createdAt: "asc" } },
      },
    });

    expect(persisted.schemaVersions).toHaveLength(1);
    expect(persisted.currentSchemaVersionId).toBe(persisted.schemaVersions[0].id);
    expect(persisted.currentSchemaVersion).toEqual(
      expect.objectContaining({
        projectId: project.id,
        major: 1,
        minor: 0,
        versionLabel: "v1.0",
        snapshot: { fields: [] },
        changeSummary: "Initial empty schema",
        actorId: owner.id,
      }),
    );
  });

  it("appends a new schema version without mutating v1.0", async () => {
    const owner = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });

    const next = await createSchemaVersion({
      actorId: owner.id,
      projectId: project.id,
      snapshot: {
        fields: [
          {
            id: "fld_product_name",
            name: "product_name",
            type: "string",
            required: true,
            minLength: 3,
            maxLength: 80,
          },
        ],
      },
      changeSummary: "Added product_name field",
    });

    const versions = await prisma.schemaVersion.findMany({
      where: { projectId: project.id },
      orderBy: [{ major: "asc" }, { minor: "asc" }],
    });
    const current = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: { currentSchemaVersionId: true },
    });

    expect(next.versionLabel).toBe("v1.1");
    expect(versions).toEqual([
      expect.objectContaining({
        versionLabel: "v1.0",
        snapshot: { fields: [] },
      }),
      expect.objectContaining({
        versionLabel: "v1.1",
        snapshot: next.snapshot,
      }),
    ]);
    expect(current.currentSchemaVersionId).toBe(next.id);
  });
});
