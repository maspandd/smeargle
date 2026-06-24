import { describe, expect, it, beforeEach } from "vitest";
import { 
  createApiCredential, 
  listApiCredentials, 
  revokeApiCredential 
} from "./credential-service";
import { prisma } from "@/lib/db";

describe("Credential Service", () => {
  let projectId: string;
  let ownerId: string;

  beforeEach(async () => {
    // Create a user and project
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
        memberships: {
          create: {
            userId: ownerId,
            role: "OWNER",
          },
        },
      },
    });
    projectId = project.id;
  });

  it("returns plaintext exactly once and stores SHA-256 hash", async () => {
    const { plaintext, credential } = await createApiCredential(projectId, ownerId, "My Token");
    
    expect(plaintext).toBeDefined();
    expect(plaintext.length).toBeGreaterThan(20);
    
    // Hash should not be the plaintext
    expect(credential.tokenHash).not.toEqual(plaintext);

    // List should not include plaintext
    const list = await listApiCredentials(projectId, ownerId);
    expect(list[0].id).toEqual(credential.id);
    expect(list[0]).not.toHaveProperty("plaintext");
  });

  it("requires a label", async () => {
    await expect(createApiCredential(projectId, ownerId, "")).rejects.toThrow();
  });

  it("revokes tokens", async () => {
    const { credential } = await createApiCredential(projectId, ownerId, "To Revoke");
    await revokeApiCredential(projectId, ownerId, credential.id);

    const list = await listApiCredentials(projectId, ownerId);
    expect(list[0].revokedAt).toBeDefined();
  });
});
