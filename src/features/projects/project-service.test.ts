import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { createProjectInput } from "./project-schema";
import { createProject, listProjectsForUser } from "./project-service";

afterEach(resetDatabase);

describe("project input", () => {
  it("rejects a blank project name", () => {
    const result = createProjectInput.safeParse({
      name: "   ",
      baseEndpoint: "/api/products",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Project name is required",
      );
    }
  });

  it("rejects an endpoint without a leading slash", () => {
    const result = createProjectInput.safeParse({
      name: "Products API",
      baseEndpoint: "products",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.baseEndpoint).toContain(
        "Endpoint must start with /",
      );
    }
  });

  it.each(["/api/products?draft=true", "/api/products#draft"])(
    "rejects query strings and fragments in %s",
    (baseEndpoint) => {
      const result = createProjectInput.safeParse({
        name: "Products API",
        baseEndpoint,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.baseEndpoint).toContain(
          "Endpoint cannot include a query string or fragment",
        );
      }
    },
  );

  it("normalizes repeated and trailing slashes", () => {
    const result = createProjectInput.safeParse({
      name: "E-commerce Products API",
      baseEndpoint: "//api///products/",
    });

    expect(result.success && result.data.baseEndpoint).toBe("/api/products");
  });

  it("rejects the reserved mock runtime path", () => {
    const result = createProjectInput.safeParse({
      name: "Products API",
      baseEndpoint: "/api/mock/products",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.baseEndpoint).toContain(
        "Endpoint is reserved by the platform",
      );
    }
  });
});

describe("project creation", () => {
  it("creates v1.0 with one owner and one creation audit event", async () => {
    const user = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });

    const project = await createProject({
      actorId: user.id,
      name: "E-commerce Products API",
      baseEndpoint: "/api/products",
    });

    expect(project.currentVersion).toBe("v1.0");
    expect(project.routeKey).not.toBe(project.id);
    expect(project.routeKey.length).toBeGreaterThanOrEqual(20);
    await expect(
      prisma.projectMembership.count({
        where: { projectId: project.id, role: "OWNER" },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { projectId: project.id, action: "PROJECT_CREATED" },
      }),
    ).resolves.toBe(1);
  });

  it("rolls back all project rows when the actor does not exist", async () => {
    await expect(
      createProject({
        actorId: "missing-user",
        name: "Products API",
        baseEndpoint: "/api/products",
      }),
    ).rejects.toThrow();

    await expect(prisma.project.count()).resolves.toBe(0);
    await expect(prisma.projectMembership.count()).resolves.toBe(0);
    await expect(prisma.auditEvent.count()).resolves.toBe(0);
  });
});

describe("project dashboard", () => {
  it("lists only projects accessible to the user with role and version", async () => {
    const owner = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });
    const otherOwner = await prisma.user.create({
      data: { email: "other@example.test", passwordHash: "hash" },
    });
    const accessible = await createProject({
      actorId: owner.id,
      name: "Products API",
      baseEndpoint: "/api/products",
    });
    await createProject({
      actorId: otherOwner.id,
      name: "Orders API",
      baseEndpoint: "/api/orders",
    });

    const projects = await listProjectsForUser(owner.id);

    expect(projects).toEqual([
      expect.objectContaining({
        id: accessible.id,
        name: "Products API",
        baseEndpoint: "/api/products",
        role: "OWNER",
        currentVersion: "v1.0",
      }),
    ]);
  });
});
