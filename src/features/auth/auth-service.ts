import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./session";

const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = "Invalid email or password";

export async function login(input: unknown) {
  const parsed = loginInput.safeParse(input);
  if (!parsed.success) throw new Error(INVALID_CREDENTIALS);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !(await verifyPassword(user.passwordHash, parsed.data.password))
  ) {
    throw new Error(INVALID_CREDENTIALS);
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export async function logout(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function requireUser(token?: string | null) {
  if (!token) throw new Error("Authentication required");

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: { id: true, email: true, systemRole: true, status: true },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  ) {
    throw new Error("Authentication required");
  }

  return session.user;
}
