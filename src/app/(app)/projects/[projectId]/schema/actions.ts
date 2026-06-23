"use server";

import { requireUser } from "@/features/auth/auth-service";
import { createFieldId } from "@/features/schema/field-id";
import { mutateSchema } from "@/features/schema/schema-service";
import type { FieldDefinition } from "@/features/schema/schema-types";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("string"),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("number"),
    min: z.number().optional(),
    max: z.number().optional(),
    precision: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("date"),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
  }),
  z.object({
    type: z.literal("email"),
  }),
]);

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
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("object"),
    required: z.boolean(),
  }),
  z.object({
    name: z.string().trim().min(1),
    type: z.literal("array"),
    required: z.boolean(),
    minItems: z.number().int().min(0).optional(),
    maxItems: z.number().int().min(0).optional(),
    item: itemInput,
  }),
]);

export async function addFieldAction(
  projectId: string,
  expectedVersionId: string,
  parentFieldPath: string[],
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
      parentFieldPath,
      field: buildField(parsed),
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

function buildField(parsed: z.infer<typeof addFieldInput>): FieldDefinition {
  if (parsed.type === "object") {
    return {
      id: createFieldId(),
      name: parsed.name,
      type: "object",
      required: parsed.required,
      fields: [],
    };
  }

  if (parsed.type === "array") {
    const { item, ...rest } = parsed;
    return {
      id: createFieldId(),
      name: rest.name,
      type: "array",
      required: rest.required,
      ...(rest.minItems === undefined ? {} : { minItems: rest.minItems }),
      ...(rest.maxItems === undefined ? {} : { maxItems: rest.maxItems }),
      item: {
        id: createFieldId(),
        name: "item",
        required: false,
        ...item,
      } as FieldDefinition,
    };
  }

  return { id: createFieldId(), ...parsed } as FieldDefinition;
}

async function currentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  return (await requireUser(token)).id;
}
