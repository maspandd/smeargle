import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { login, logout, requireUser } from "./auth-service";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./session";

afterEach(resetDatabase);

describe("authentication primitives", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-42");
    expect(hash).not.toContain("Correct-Horse-42");
    await expect(verifyPassword(hash, "Correct-Horse-42")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("creates an opaque session token and a distinct database hash", () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });
});

describe("login", () => {
  it("returns a plaintext token backed by a hashed, expiring session", async () => {
    const user = await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });

    const result = await login({
      email: "owner@example.test",
      password: "Correct-Horse-42",
    });
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(result.token) },
    });

    expect(session.tokenHash).not.toBe(result.token);
    expect(session.userId).toBe(user.id);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects an unknown email with the generic credential error", async () => {
    await expect(
      login({ email: "missing@example.test", password: "wrong-password" }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects a wrong password with the generic credential error", async () => {
    await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });

    await expect(
      login({ email: "owner@example.test", password: "wrong-password" }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects a disabled account with the generic credential error", async () => {
    await prisma.user.create({
      data: {
        email: "disabled@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
        status: "DISABLED",
      },
    });

    await expect(
      login({
        email: "disabled@example.test",
        password: "Correct-Horse-42",
      }),
    ).rejects.toThrow("Invalid email or password");
  });
});

describe("authenticated sessions", () => {
  async function createAuthenticatedUser() {
    const user = await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });
    const session = await login({
      email: user.email,
      password: "Correct-Horse-42",
    });
    return { user, ...session };
  }

  it("resolves an active user from an unexpired session token", async () => {
    const { user, token } = await createAuthenticatedUser();

    await expect(requireUser(token)).resolves.toMatchObject({ id: user.id });
  });

  it("revokes the session on logout", async () => {
    const { token } = await createAuthenticatedUser();

    await logout(token);

    await expect(requireUser(token)).rejects.toThrow("Authentication required");
  });

  it("rejects an expired session", async () => {
    const { token } = await createAuthenticatedUser();
    await prisma.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    await expect(requireUser(token)).rejects.toThrow("Authentication required");
  });

  it("rejects a session after its user is disabled", async () => {
    const { user, token } = await createAuthenticatedUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "DISABLED" },
    });

    await expect(requireUser(token)).rejects.toThrow("Authentication required");
  });
});
