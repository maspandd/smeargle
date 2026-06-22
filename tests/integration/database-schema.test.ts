import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";

describe("project persistence", () => {
  afterEach(resetDatabase);

  it("stores one owner and an immutable creation audit event", async () => {
    const user = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });
    const project = await prisma.project.create({
      data: {
        name: "Products API",
        baseEndpoint: "/api/products",
        routeKey: "products_test_key",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        auditEvents: {
          create: { actorId: user.id, action: "PROJECT_CREATED", metadata: {} },
        },
      },
      include: { memberships: true, auditEvents: true },
    });

    expect(project.memberships).toHaveLength(1);
    expect(project.memberships[0].role).toBe("OWNER");
    expect(project.auditEvents[0].action).toBe("PROJECT_CREATED");
  });
});
