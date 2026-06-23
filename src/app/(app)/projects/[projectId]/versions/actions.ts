"use server";

import { requireUser } from "@/features/auth/auth-service";
import {
  rollbackSchemaVersion,
  type RollbackSchemaVersionResult,
} from "@/features/versions/rollback-service";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function rollbackVersionAction(
  projectId: string,
  versionId: string,
  expectedVersionId: string,
  confirmedImpact: boolean,
): Promise<RollbackSchemaVersionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  const actor = await requireUser(token);
  const result = await rollbackSchemaVersion({
    actorId: actor.id,
    projectId,
    versionId,
    expectedVersionId,
    confirmedImpact,
  });

  if (result.ok) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/versions`);
  }

  return result;
}
