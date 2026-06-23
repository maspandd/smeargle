import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { createProject } from "../projects/project-service";
import { mutateSchema } from "../schema/schema-service";
import { rollbackSchemaVersion } from "./rollback-service";

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

function expectMutationOk(result: Awaited<ReturnType<typeof mutateSchema>>) {
  if (!result.ok) {
    throw new Error(`Expected schema mutation to succeed, received ${result.code}`);
  }

  return result;
}

describe("rollback schema version", () => {
  it("creates v1.5 from v1.2, preserves later history, stores restoredFromId, and flags incompatible data", async () => {
    const owner = await createUser("rollback-owner@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    const initialVersion = await currentVersion(project.id);

    const v11 = expectMutationOk(await mutateSchema({
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
        },
      },
    }));

    const v12 = expectMutationOk(await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: v11.version.id,
      mutation: {
        type: "addField",
        parentFieldPath: [],
        field: {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
          min: 0,
        },
      },
    }));

    const v13 = expectMutationOk(await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: v12.version.id,
      mutation: {
        type: "editField",
        fieldPath: ["fld_price"],
        field: {
          id: "fld_price",
          name: "price",
          type: "number",
          required: false,
          min: 0,
        },
      },
    }));

    const v14 = expectMutationOk(await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: v13.version.id,
      mutation: {
        type: "addField",
        parentFieldPath: [],
        field: {
          id: "fld_description",
          name: "description",
          type: "string",
          required: false,
        },
      },
    }));

    await prisma.project.update({
      where: { id: project.id },
      data: { dataStatus: "COMPATIBLE" },
    });

    const result = await rollbackSchemaVersion({
      actorId: owner.id,
      projectId: project.id,
      versionId: v12.version.id,
      expectedVersionId: v14.version.id,
      confirmedImpact: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        compatibility: expect.objectContaining({
          kind: "INCOMPATIBLE",
          operation: "REGENERATE_RECORDS",
          affectedPaths: expect.arrayContaining(["price"]),
        }),
        version: expect.objectContaining({
          versionLabel: "v1.5",
          snapshot: v12.version.snapshot,
        }),
      }),
    );

    const versions = await prisma.schemaVersion.findMany({
      where: { projectId: project.id },
      orderBy: [{ major: "asc" }, { minor: "asc" }],
      select: {
        id: true,
        versionLabel: true,
        snapshot: true,
        restoredFromId: true,
      },
    });
    expect(versions.map((version) => version.versionLabel)).toEqual([
      "v1.0",
      "v1.1",
      "v1.2",
      "v1.3",
      "v1.4",
      "v1.5",
    ]);
    expect(versions[2].snapshot).toEqual(v12.version.snapshot);
    expect(versions[4].snapshot).toEqual(v14.version.snapshot);
    expect(versions[5]).toEqual(
      expect.objectContaining({
        versionLabel: "v1.5",
        restoredFromId: v12.version.id,
        snapshot: v12.version.snapshot,
      }),
    );
    await expect(
      prisma.project.findUniqueOrThrow({
        where: { id: project.id },
        select: {
          currentMajor: true,
          currentMinor: true,
          currentSchemaVersionId: true,
          dataStatus: true,
        },
      }),
    ).resolves.toEqual({
      currentMajor: 1,
      currentMinor: 5,
      currentSchemaVersionId: versions[5].id,
      dataStatus: "INCOMPATIBLE",
    });
  });

  it("requires confirmation and does not create a new version when rollback is cancelled", async () => {
    const owner = await createUser("rollback-owner-cancel@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    const initialVersion = await currentVersion(project.id);

    const v11 = expectMutationOk(await mutateSchema({
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
        },
      },
    }));

    const result = await rollbackSchemaVersion({
      actorId: owner.id,
      projectId: project.id,
      versionId: initialVersion.id,
      expectedVersionId: v11.version.id,
      confirmedImpact: false,
    });

    expect(result).toEqual({ ok: false, code: "ROLLBACK_CONFIRMATION_REQUIRED" });
    await expect(
      prisma.schemaVersion.count({ where: { projectId: project.id } }),
    ).resolves.toBe(2);
  });
});
