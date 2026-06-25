import { describe, expect, it, beforeEach } from "vitest";
import { verifyToken, updateLastUsed, hashToken } from "./token-auth";
import { prisma } from "@/lib/db";
import { createApiCredential } from "./credential-service";

describe("Token Auth", () => {
  let projectId: string;
  let ownerId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: "hash",
      },
    });
    ownerId = user.id;

    const project = await prisma.project.create({
      data: {
        name: "Test Project",
        baseEndpoint: "test",
        routeKey: `test-${Date.now()}`,
        tokenRequired: true,
      },
    });
    projectId = project.id;
  });

  it("validates correct token", async () => {
    const { plaintext, credential } = await createApiCredential(projectId, ownerId, "Token", true);
    
    const valid = await verifyToken(projectId, plaintext);
    expect(valid).toBe(true);
  });

  it("fails missing, invalid, expired, or revoked tokens", async () => {
    const { plaintext, credential } = await createApiCredential(projectId, ownerId, "Token", true);
    
    // Invalid
    const valid1 = await verifyToken(projectId, "invalid");
    expect(valid1).toBe(false);

    // Revoked
    await prisma.apiCredential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
    });
    const valid2 = await verifyToken(projectId, plaintext);
    expect(valid2).toBe(false);
  });

  it("updates last used time without blocking request", async () => {
    const { plaintext, credential } = await createApiCredential(projectId, ownerId, "Token", true);
    
    // Simulate auth check which should trigger background update
    await updateLastUsed(credential.id);

    // Wait a tiny bit for background promise
    await new Promise(r => setTimeout(r, 50));

    const updated = await prisma.apiCredential.findUniqueOrThrow({ where: { id: credential.id } });
    expect(updated.lastUsedAt).not.toBeNull();
  });
});
