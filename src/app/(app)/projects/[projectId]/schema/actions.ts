"use server";

import { requireUser } from "@/features/auth/auth-service";
import { createFieldId } from "@/features/schema/field-id";
import { mutateSchema } from "@/features/schema/schema-service";
import type { FieldDefinition } from "@/features/schema/schema-types";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addFieldInput = z.discriminatedUnion("type", [
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("string"),
    required: z.boolean(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
  }),
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("number"),
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    precision: z.number().int().min(0).optional(),
  }),
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("date"),
    required: z.boolean(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
  }),
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("email"),
    required: z.boolean(),
  }),
]);

export async function addRootFieldAction(
  projectId: string,
  expectedVersionId: string,
  input: unknown,
) {
  const actorId = await currentUserId();
  const parsed = addFieldInput.parse(input);
  const result = await mutateSchema({
    actorId,
    projectId,
    expectedVersionId,
    mutation: {
      type: "addField",
      parentFieldPath: [],
      field: {
        id: createFieldId(),
        ...parsed,
      } as FieldDefinition,
    },
  });

  if (!result.ok) return result;

  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true as const,
    versionId: result.version.id,
    versionLabel: result.version.versionLabel,
    snapshot: result.version.snapshot,
  };
}

async function currentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  return (await requireUser(token)).id;
}
