import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { createProject } from "../projects/project-service";
import { ForbiddenError } from "../projects/authorization";
import { mutateSchema } from "./schema-service";

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

describe("schema service authorization and conflicts", () => {
  it("allows an Owner to add a field and create v1.1", async () => {
    const owner = await createUser("owner@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    const version = await currentVersion(project.id);

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
          minLength: 3,
          maxLength: 80,
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        version: expect.objectContaining({
          versionLabel: "v1.1",
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
        }),
      }),
    );
  });

  it("allows an Editor to add a field", async () => {
    const owner = await createUser("owner@example.test");
    const editor = await createUser("editor@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    await prisma.projectMembership.create({
      data: { projectId: project.id, userId: editor.id, role: "EDITOR" },
    });
    const version = await currentVersion(project.id);

    const result = await mutateSchema({
      actorId: editor.id,
      projectId: project.id,
      expectedVersionId: version.id,
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
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a Viewer before mutating schema", async () => {
    const owner = await createUser("owner@example.test");
    const viewer = await createUser("viewer@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    await prisma.projectMembership.create({
      data: { projectId: project.id, userId: viewer.id, role: "VIEWER" },
    });
    const version = await currentVersion(project.id);

    await expect(
      mutateSchema({
        actorId: viewer.id,
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
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      prisma.schemaVersion.count({ where: { projectId: project.id } }),
    ).resolves.toBe(1);
  });

  it("returns VERSION_CONFLICT for a stale expected version without creating rows", async () => {
    const owner = await createUser("owner@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    const version = await currentVersion(project.id);

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

    const result = await mutateSchema({
      actorId: owner.id,
      projectId: project.id,
      expectedVersionId: version.id,
      mutation: {
        type: "addField",
        parentFieldPath: [],
        field: {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
        },
      },
    });

    expect(result).toEqual({ ok: false, code: "VERSION_CONFLICT" });
    await expect(
      prisma.schemaVersion.count({ where: { projectId: project.id } }),
    ).resolves.toBe(2);
  });
});
