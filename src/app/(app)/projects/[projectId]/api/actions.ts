"use server";

import { requireUser } from "@/features/auth/auth-service";
import { createApiCredential, listApiCredentials, revokeApiCredential } from "@/features/mock-runtime/credential-service";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectCapability } from "@/features/projects/authorization";

export async function createTokenAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const label = formData.get("label") as string;
  
  if (!label) throw new Error("Label is required");

  const { plaintext } = await createApiCredential(projectId, user.id, label);
  
  revalidatePath(`/projects/${projectId}/api`);
  return { plaintext };
}

export async function revokeTokenAction(projectId: string, credentialId: string) {
  const user = await requireUser();
  await revokeApiCredential(projectId, user.id, credentialId);
  revalidatePath(`/projects/${projectId}/api`);
}

export async function toggleTokenRequiredAction(projectId: string, required: boolean) {
  const user = await requireUser();
  await requireProjectCapability({ projectId, userId: user.id, capability: "manage_api" });
  
  await prisma.project.update({
    where: { id: projectId },
    data: { tokenRequired: required },
  });
  
  revalidatePath(`/projects/${projectId}/api`);
}
