"use server";

import { login } from "@/features/auth/auth-service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginForm = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginActionState = {
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  formError?: string;
};

export const initialLoginState: LoginActionState = {};

export async function loginAction(
  _state: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginForm.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const session = await login(parsed.data);
    const cookieStore = await cookies();
    cookieStore.set(
      process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
      session.token,
      {
        expires: session.expiresAt,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    );
  } catch {
    return { formError: "Invalid email or password" };
  }

  redirect("/dashboard");
}
