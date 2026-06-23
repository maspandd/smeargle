import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/features/auth/password";
import { login } from "@/features/auth/auth-service";
import { resetDatabase } from "../../../../tests/helpers/database";
import { createProjectAction } from "./actions";

const nextMocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () =>
      nextMocks.cookieValue ? { value: nextMocks.cookieValue } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: nextMocks.redirect }));

afterEach(async () => {
  nextMocks.cookieValue = undefined;
  nextMocks.redirect.mockReset();
  await resetDatabase();
});

describe("create project action", () => {
  it("rejects unauthenticated project creation", async () => {
    await expect(
      createProjectAction({ name: "Products API", baseEndpoint: "/api/products" }),
    ).rejects.toThrow("Authentication required");
    await expect(prisma.project.count()).resolves.toBe(0);
  });

  it("repeats project validation on the server", async () => {
    const user = await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });
    nextMocks.cookieValue = (
      await login({ email: user.email, password: "Correct-Horse-42" })
    ).token;

    await expect(
      createProjectAction({ name: "", baseEndpoint: "products" }),
    ).rejects.toThrow("Project name is required");
    await expect(prisma.project.count()).resolves.toBe(0);
  });

  it("creates the project and redirects to its workspace", async () => {
    const user = await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });
    nextMocks.cookieValue = (
      await login({ email: user.email, password: "Correct-Horse-42" })
    ).token;

    await createProjectAction({
      name: "Products API",
      baseEndpoint: "/api/products/",
    });

    const project = await prisma.project.findFirstOrThrow();
    expect(project.baseEndpoint).toBe("/api/products");
    expect(nextMocks.redirect).toHaveBeenCalledWith(`/projects/${project.id}`);
  });
});
