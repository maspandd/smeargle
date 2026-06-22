import type { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ProjectCapability =
  | "view_project"
  | "mutate_records"
  | "edit_schema"
  | "manage_api"
  | "manage_members"
  | "manage_settings"
  | "delete_project";

const capabilitiesByRole = {
  OWNER: [
    "view_project",
    "mutate_records",
    "edit_schema",
    "manage_api",
    "manage_members",
    "manage_settings",
    "delete_project",
  ],
  EDITOR: ["view_project", "mutate_records", "edit_schema", "manage_api"],
  VIEWER: ["view_project"],
} as const satisfies Record<ProjectRole, readonly ProjectCapability[]>;

export function can(
  role: ProjectRole,
  capability: ProjectCapability,
): boolean {
  return (capabilitiesByRole[role] as readonly ProjectCapability[]).includes(
    capability,
  );
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";

  constructor() {
    super("You do not have permission to perform this action");
    this.name = "ForbiddenError";
  }
}

type RequireProjectCapabilityInput = {
  userId: string;
  projectId: string;
  capability: ProjectCapability;
};

export async function requireProjectCapability({
  userId,
  projectId,
  capability,
}: RequireProjectCapabilityInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      systemRole: true,
      memberships: {
        where: { projectId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!user || user.status !== "ACTIVE") throw new ForbiddenError();
  if (user.systemRole === "ADMIN") return;

  const membership = user.memberships[0];
  if (!membership || !can(membership.role, capability)) {
    throw new ForbiddenError();
  }
}
