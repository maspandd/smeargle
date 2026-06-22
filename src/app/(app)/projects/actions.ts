"use server";

import { requireUser } from "@/features/auth/auth-service";
import { createProject } from "@/features/projects/project-service";
import type { CreateProjectInput } from "@/features/projects/project-schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createProjectAction(input: CreateProjectInput): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  const user = await requireUser(token);
  const project = await createProject({ actorId: user.id, ...input });

  redirect(`/projects/${project.id}`);
}
