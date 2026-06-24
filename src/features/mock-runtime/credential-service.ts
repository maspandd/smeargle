import { prisma } from "@/lib/db";
import { requireProjectCapability } from "@/features/projects/authorization";
import { generateToken, hashToken } from "./token-auth";

export async function createApiCredential(projectId: string, actorId: string, label: string, skipAuth = false) {
  if (!skipAuth) {
    await requireProjectCapability({ projectId, userId: actorId, capability: "manage_api" });
  }

  if (!label || label.trim() === "") {
    throw new Error("Label is required");
  }

  const plaintext = await generateToken();
  const tokenHash = await hashToken(plaintext);

  const credential = await prisma.$transaction(async (tx) => {
    const cred = await tx.apiCredential.create({
      data: {
        projectId,
        label,
        tokenHash,
      },
    });

    await tx.auditEvent.create({
      data: {
        projectId,
        actorId,
        action: "API_CREDENTIAL_CREATED",
        metadata: { credentialId: cred.id, label },
      },
    });

    return cred;
  });

  return { plaintext, credential };
}

export async function listApiCredentials(projectId: string, actorId: string) {
  await requireProjectCapability({ projectId, userId: actorId, capability: "manage_api" });

  return prisma.apiCredential.findMany({
    where: { projectId },
    select: {
      id: true,
      label: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiCredential(projectId: string, actorId: string, credentialId: string) {
  await requireProjectCapability({ projectId, userId: actorId, capability: "manage_api" });

  await prisma.$transaction(async (tx) => {
    await tx.apiCredential.update({
      where: { id: credentialId, projectId },
      data: { revokedAt: new Date() },
    });

    await tx.auditEvent.create({
      data: {
        projectId,
        actorId,
        action: "API_CREDENTIAL_REVOKED",
        metadata: { credentialId },
      },
    });
  });
}
