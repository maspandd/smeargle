import { Prisma, type ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectCapability } from "./authorization";

const LAST_OWNER_ERROR = "Project must retain at least one owner";

type MemberMutation = {
  actorId: string;
  projectId: string;
  userId: string;
};

type AddMemberInput = MemberMutation & { role: "EDITOR" | "VIEWER" };
type ChangeMemberRoleInput = MemberMutation & { role: ProjectRole };

async function lockOwners(
  transaction: Prisma.TransactionClient,
  projectId: string,
) {
  return transaction.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId"
    FROM "ProjectMembership"
    WHERE "projectId" = ${projectId}
      AND "role" = 'OWNER'::"ProjectRole"
    FOR UPDATE
  `;
}

export async function addMember(input: AddMemberInput): Promise<void> {
  await requireProjectCapability({
    userId: input.actorId,
    projectId: input.projectId,
    capability: "manage_members",
  });

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.projectMembership.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          projectId: input.projectId,
          action: "MEMBER_ADDED",
          metadata: { userId: input.userId, role: input.role },
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("User is already a project member");
    }
    throw error;
  }
}

export async function changeMemberRole(
  input: ChangeMemberRoleInput,
): Promise<void> {
  await requireProjectCapability({
    userId: input.actorId,
    projectId: input.projectId,
    capability: "manage_members",
  });

  await prisma.$transaction(async (transaction) => {
    const membership = await transaction.projectMembership.findUniqueOrThrow({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.userId },
      },
    });

    if (membership.role === "OWNER" && input.role !== "OWNER") {
      const owners = await lockOwners(transaction, input.projectId);
      if (owners.length <= 1) throw new Error(LAST_OWNER_ERROR);
    }

    await transaction.projectMembership.update({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.userId },
      },
      data: { role: input.role },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: input.actorId,
        projectId: input.projectId,
        action: "MEMBER_ROLE_CHANGED",
        metadata: {
          userId: input.userId,
          fromRole: membership.role,
          toRole: input.role,
        },
      },
    });
  });
}

export async function removeMember(input: MemberMutation): Promise<void> {
  await requireProjectCapability({
    userId: input.actorId,
    projectId: input.projectId,
    capability: "manage_members",
  });

  await prisma.$transaction(async (transaction) => {
    const membership = await transaction.projectMembership.findUniqueOrThrow({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.userId },
      },
    });

    if (membership.role === "OWNER") {
      const owners = await lockOwners(transaction, input.projectId);
      if (owners.length <= 1) throw new Error(LAST_OWNER_ERROR);
    }

    await transaction.projectMembership.delete({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.userId },
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: input.actorId,
        projectId: input.projectId,
        action: "MEMBER_REMOVED",
        metadata: { userId: input.userId, role: membership.role },
      },
    });
  });
}
