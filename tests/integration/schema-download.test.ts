import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSessionToken, hashSessionToken } from "@/features/auth/session";
import { createProject } from "@/features/projects/project-service";
import { mutateSchema } from "@/features/schema/schema-service";
import { GET } from "@/app/api/projects/[projectId]/versions/[versionId]/download/route";
import { resetDatabase } from "../helpers/database";

afterEach(resetDatabase);

async function createUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "hash" },
  });
}

async function createSession(userId: string) {
  const token = createSessionToken();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return token;
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

describe("schema download route", () => {
  it("allows a viewer to download a selected snapshot with project metadata, version metadata, and a sanitized filename", async () => {
    const owner = await createUser("download-owner@example.test");
    const viewer = await createUser("download-viewer@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "E-commerce Products API",
      baseEndpoint: "/api/products",
    });
    await prisma.projectMembership.create({
      data: { projectId: project.id, userId: viewer.id, role: "VIEWER" },
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

    const token = await createSession(viewer.id);
    const response = await GET(
      new Request(
        `http://localhost:3000/api/projects/${project.id}/versions/${v12.version.id}/download`,
        {
          headers: {
            cookie: `mock_data_session=${token}`,
          },
        },
      ),
      {
        params: Promise.resolve({
          projectId: project.id,
          versionId: v12.version.id,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="e-commerce-products-api-schema-v1.2.json"',
    );
    await expect(response.json()).resolves.toEqual({
      format: "mock-data-generator-schema",
      formatVersion: 1,
      productVersion: "0.1.0",
      project: {
        id: project.id,
        name: "E-commerce Products API",
        baseEndpoint: "/api/products",
      },
      version: {
        id: v12.version.id,
        label: "v1.2",
        createdAt: expect.any(String),
      },
      schema: v12.version.snapshot,
    });
  });

  it("returns forbidden for a non-member", async () => {
    const owner = await createUser("download-owner-forbidden@example.test");
    const outsider = await createUser("download-outsider@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    const version = await currentVersion(project.id);
    const token = await createSession(outsider.id);

    const response = await GET(
      new Request(
        `http://localhost:3000/api/projects/${project.id}/versions/${version.id}/download`,
        {
          headers: {
            cookie: `mock_data_session=${token}`,
          },
        },
      ),
      {
        params: Promise.resolve({
          projectId: project.id,
          versionId: version.id,
        }),
      },
    );

    expect(response.status).toBe(403);
  });
});
