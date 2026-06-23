"use server";

import type { ProjectRole } from "@prisma/client";
import { requireUser } from "@/features/auth/auth-service";
import {
  addMember,
  changeMemberRole,
  removeMember,
} from "@/features/projects/membership-service";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function currentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  return (await requireUser(token)).id;
}

export async function addMemberAction(
  projectId: string,
  input: { email: string; role: "EDITOR" | "VIEWER" },
) {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(["EDITOR", "VIEWER"]),
    })
    .parse(input);
  const actorId = await currentUserId();
  const user = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") throw new Error("User not found");

  await addMember({ actorId, projectId, userId: user.id, role: parsed.role });
  revalidatePath(`/projects/${projectId}/members`);
}

export async function changeMemberRoleAction(
  projectId: string,
  userId: string,
  role: ProjectRole,
) {
  const parsed = z.enum(["OWNER", "EDITOR", "VIEWER"]).parse(role);
  await changeMemberRole({
    actorId: await currentUserId(),
    projectId,
    userId,
    role: parsed,
  });
  revalidatePath(`/projects/${projectId}/members`);
}

export async function removeMemberAction(projectId: string, userId: string) {
  await removeMember({
    actorId: await currentUserId(),
    projectId,
    userId: z.string().min(1).parse(userId),
  });
  revalidatePath(`/projects/${projectId}/members`);
}
