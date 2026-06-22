import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  requireProjectCapability,
} from "@/features/projects/authorization";
import { createProject } from "@/features/projects/project-service";
import { resetDatabase } from "../helpers/database";

afterEach(resetDatabase);

async function createUser(email: string, systemRole: "USER" | "ADMIN" = "USER") {
  return prisma.user.create({
    data: { email, passwordHash: "hash", systemRole },
  });
}

describe("project capability enforcement", () => {
  it("rejects a user with no project membership", async () => {
    const owner = await createUser("owner@example.test");
    const outsider = await createUser("outsider@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });

    await expect(
      requireProjectCapability({
        userId: outsider.id,
        projectId: project.id,
        capability: "view_project",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a Viewer from editing the schema", async () => {
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

    await expect(
      requireProjectCapability({
        userId: viewer.id,
        projectId: project.id,
        capability: "edit_schema",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows an Owner to manage members", async () => {
    const owner = await createUser("owner@example.test");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });

    await expect(
      requireProjectCapability({
        userId: owner.id,
        projectId: project.id,
        capability: "manage_members",
      }),
    ).resolves.toBeUndefined();
  });

  it("allows an active system administrator without membership", async () => {
    const owner = await createUser("owner@example.test");
    const admin = await createUser("admin@example.test", "ADMIN");
    const project = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });

    await expect(
      requireProjectCapability({
        userId: admin.id,
        projectId: project.id,
        capability: "delete_project",
      }),
    ).resolves.toBeUndefined();
  });
});
