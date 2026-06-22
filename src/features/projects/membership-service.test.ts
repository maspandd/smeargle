import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { ForbiddenError } from "./authorization";
import {
  addMember,
  changeMemberRole,
  removeMember,
} from "./membership-service";
import { createProject } from "./project-service";

afterEach(resetDatabase);

describe("project membership", () => {
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let projectId: string;

  beforeEach(async () => {
    const [owner, editor, viewer] = await Promise.all([
      prisma.user.create({
        data: { email: "owner@example.test", passwordHash: "hash" },
      }),
      prisma.user.create({
        data: { email: "editor@example.test", passwordHash: "hash" },
      }),
      prisma.user.create({
        data: { email: "viewer@example.test", passwordHash: "hash" },
      }),
    ]);
    ownerId = owner.id;
    editorId = editor.id;
    viewerId = viewer.id;
    projectId = (
      await createProject({
        actorId: ownerId,
        name: "Products API",
        baseEndpoint: "/api/products",
      })
    ).id;
  });

  it.each([
    ["EDITOR", "editorId"],
    ["VIEWER", "viewerId"],
  ] as const)("allows an Owner to add a %s", async (role, targetKey) => {
    const userId = targetKey === "editorId" ? editorId : viewerId;

    await addMember({ actorId: ownerId, projectId, userId, role });

    await expect(
      prisma.projectMembership.findUnique({
        where: { projectId_userId: { projectId, userId } },
      }),
    ).resolves.toMatchObject({ role });
    await expect(
      prisma.auditEvent.count({
        where: { projectId, actorId: ownerId, action: "MEMBER_ADDED" },
      }),
    ).resolves.toBe(1);
  });

  it("rejects an Editor from managing members", async () => {
    await prisma.projectMembership.create({
      data: { projectId, userId: editorId, role: "EDITOR" },
    });

    await expect(
      addMember({
        actorId: editorId,
        projectId,
        userId: viewerId,
        role: "VIEWER",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects duplicate membership", async () => {
    await addMember({
      actorId: ownerId,
      projectId,
      userId: viewerId,
      role: "VIEWER",
    });

    await expect(
      addMember({
        actorId: ownerId,
        projectId,
        userId: viewerId,
        role: "VIEWER",
      }),
    ).rejects.toThrow("User is already a project member");
  });

  it("changes a member role and audits the change", async () => {
    await addMember({
      actorId: ownerId,
      projectId,
      userId: editorId,
      role: "EDITOR",
    });

    await changeMemberRole({
      actorId: ownerId,
      projectId,
      userId: editorId,
      role: "VIEWER",
    });

    await expect(
      prisma.projectMembership.findUniqueOrThrow({
        where: { projectId_userId: { projectId, userId: editorId } },
      }),
    ).resolves.toMatchObject({ role: "VIEWER" });
    await expect(
      prisma.auditEvent.count({ where: { projectId, action: "MEMBER_ROLE_CHANGED" } }),
    ).resolves.toBe(1);
  });

  it("removes a member and audits the removal", async () => {
    await addMember({
      actorId: ownerId,
      projectId,
      userId: viewerId,
      role: "VIEWER",
    });

    await removeMember({ actorId: ownerId, projectId, userId: viewerId });

    await expect(
      prisma.projectMembership.count({ where: { projectId, userId: viewerId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditEvent.count({ where: { projectId, action: "MEMBER_REMOVED" } }),
    ).resolves.toBe(1);
  });

  it("prevents demoting the last Owner", async () => {
    await expect(
      changeMemberRole({
        actorId: ownerId,
        projectId,
        userId: ownerId,
        role: "EDITOR",
      }),
    ).rejects.toThrow("Project must retain at least one owner");
  });

  it("prevents removing the last Owner", async () => {
    await expect(
      removeMember({ actorId: ownerId, projectId, userId: ownerId }),
    ).rejects.toThrow("Project must retain at least one owner");
  });
});
