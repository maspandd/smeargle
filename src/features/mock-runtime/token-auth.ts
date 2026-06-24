import { prisma } from "@/lib/db";

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

export async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64url");
}

export async function verifyToken(projectId: string, token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  const credential = await prisma.apiCredential.findUnique({
    where: { tokenHash },
  });

  if (!credential) return false;
  if (credential.projectId !== projectId) return false;
  if (credential.revokedAt) return false;
  if (credential.expiresAt && credential.expiresAt < new Date()) return false;

  updateLastUsed(credential.id);

  return true;
}

export function updateLastUsed(credentialId: string): void {
  // Non-blocking update
  Promise.resolve().then(async () => {
    try {
      await prisma.apiCredential.update({
        where: { id: credentialId },
        data: { lastUsedAt: new Date() },
      });
    } catch (e) {
      // Ignore background errors
    }
  });
}
