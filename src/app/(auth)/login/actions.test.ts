import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/features/auth/password";
import { resetDatabase } from "../../../../tests/helpers/database";
import { loginAction } from "./actions";

const nextMocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: nextMocks.cookieSet }),
}));

vi.mock("next/navigation", () => ({ redirect: nextMocks.redirect }));

afterEach(async () => {
  nextMocks.cookieSet.mockReset();
  nextMocks.redirect.mockReset();
  await resetDatabase();
});

describe("login action", () => {
  it("returns serializable field errors for invalid input", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "");

    const result = await loginAction({}, formData);

    expect(result.fieldErrors).toEqual({
      email: ["Enter a valid email"],
      password: ["Password is required"],
    });
    expect(nextMocks.cookieSet).not.toHaveBeenCalled();
  });

  it("returns the generic form error for invalid credentials", async () => {
    const formData = new FormData();
    formData.set("email", "missing@example.test");
    formData.set("password", "wrong-password");

    const result = await loginAction({}, formData);

    expect(result.formError).toBe("Invalid email or password");
    expect(nextMocks.cookieSet).not.toHaveBeenCalled();
  });

  it("sets a secure session cookie before redirecting", async () => {
    await prisma.user.create({
      data: {
        email: "owner@example.test",
        passwordHash: await hashPassword("Correct-Horse-42"),
      },
    });
    const formData = new FormData();
    formData.set("email", "owner@example.test");
    formData.set("password", "Correct-Horse-42");

    await loginAction({}, formData);

    expect(nextMocks.cookieSet).toHaveBeenCalledWith(
      "mock_data_session",
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      }),
    );
    expect(nextMocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
