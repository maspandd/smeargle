import { z } from "zod";
import type { FieldDefinition, FieldType, SchemaSnapshot } from "./schema-types";

const MAX_DEPTH = 5;
const MAX_DIRECT_FIELDS = 100;

const allowedKeysByType = {
  string: new Set(["id", "name", "type", "required", "minLength", "maxLength"]),
  number: new Set(["id", "name", "type", "required", "min", "max", "precision"]),
  boolean: new Set(["id", "name", "type", "required"]),
  date: new Set(["id", "name", "type", "required", "minDate", "maxDate"]),
  email: new Set(["id", "name", "type", "required"]),
  object: new Set(["id", "name", "type", "required", "fields"]),
  array: new Set(["id", "name", "type", "required", "item", "minItems", "maxItems"]),
} satisfies Record<FieldType, Set<string>>;

const baseFieldInput = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["string", "number", "boolean", "date", "email", "object", "array"]),
  required: z.boolean(),
}).passthrough();

type RawFieldInput = z.infer<typeof baseFieldInput> & Record<string, unknown>;

const snapshotInput = z.object({
  fields: z.array(z.unknown()),
});

export function parseSchema(input: unknown): SchemaSnapshot {
  const parsed = snapshotInput.parse(input);

  return {
    fields: parseFields(parsed.fields, {
      depth: 1,
      parentPath: "root",
    }),
  };
}

function parseFields(
  input: unknown[],
  context: { depth: number; parentPath: string },
): FieldDefinition[] {
  if (input.length > MAX_DIRECT_FIELDS) {
    throw new Error(`${context.parentPath} cannot contain more than 100 direct fields`);
  }

  const seenNames = new Set<string>();

  return input.map((fieldInput) => {
    const field = parseField(fieldInput, context);
    const normalizedName = field.name.toLowerCase();

    if (seenNames.has(normalizedName)) {
      throw new Error(`Duplicate field name at ${fieldPath(context.parentPath, field.name)}`);
    }

    seenNames.add(normalizedName);
    return field;
  });
}

function parseField(
  input: unknown,
  context: { depth: number; parentPath: string },
): FieldDefinition {
  const base = baseFieldInput.parse(input) as RawFieldInput;
  const path = fieldPath(context.parentPath, base.name);

  if (context.depth > MAX_DEPTH) {
    throw new Error(`${path} exceeds the maximum schema depth of five levels`);
  }

  rejectObsoleteConstraints(base, path);

  switch (base.type) {
    case "string":
      return parseStringField(base, path);
    case "number":
      return parseNumberField(base, path);
    case "boolean":
      return {
        id: base.id,
        name: base.name,
        type: "boolean",
        required: base.required,
      };
    case "date":
      return parseDateField(base, path);
    case "email":
      return {
        id: base.id,
        name: base.name,
        type: "email",
        required: base.required,
      };
    case "object":
      return {
        id: base.id,
        name: base.name,
        type: "object",
        required: base.required,
        fields: parseFields(z.array(z.unknown()).parse(base.fields), {
          depth: context.depth + 1,
          parentPath: path,
        }),
      };
    case "array":
      return parseArrayField(base, context.depth, path);
  }
}

function parseStringField(input: RawFieldInput, path: string): FieldDefinition {
  const field = z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.literal("string"),
      required: z.boolean(),
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(0).optional(),
    })
    .parse(input);

  if (
    field.minLength !== undefined &&
    field.maxLength !== undefined &&
    field.minLength > field.maxLength
  ) {
    throw new Error(`${path} minimum length cannot exceed maximum length`);
  }

  return field;
}

function parseNumberField(input: RawFieldInput, path: string): FieldDefinition {
  const field = z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.literal("number"),
      required: z.boolean(),
      min: z.number().optional(),
      max: z.number().optional(),
      precision: z.number().int().min(0).optional(),
    })
    .parse(input);

  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    throw new Error(`${path} minimum cannot exceed maximum`);
  }

  return field;
}

function parseDateField(input: RawFieldInput, path: string): FieldDefinition {
  const field = z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.literal("date"),
      required: z.boolean(),
      minDate: z.string().optional(),
      maxDate: z.string().optional(),
    })
    .parse(input);

  if (
    field.minDate !== undefined &&
    field.maxDate !== undefined &&
    field.minDate > field.maxDate
  ) {
    throw new Error(`${path} start date cannot be after end date`);
  }

  return field;
}

function parseArrayField(
  input: RawFieldInput,
  currentDepth: number,
  path: string,
): FieldDefinition {
  const field = z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.literal("array"),
      required: z.boolean(),
      item: z.unknown(),
      minItems: z.number().int().min(0).optional(),
      maxItems: z.number().int().min(0).optional(),
    })
    .parse(input);

  if (
    field.minItems !== undefined &&
    field.maxItems !== undefined &&
    field.minItems > field.maxItems
  ) {
    throw new Error(`${path} minimum items cannot exceed maximum items`);
  }

  return {
    id: field.id,
    name: field.name,
    type: "array",
    required: field.required,
    minItems: field.minItems,
    maxItems: field.maxItems,
    item: parseField(field.item, { depth: currentDepth + 1, parentPath: path }),
  };
}

function rejectObsoleteConstraints(input: RawFieldInput, path: string) {
  const allowedKeys = allowedKeysByType[input.type];
  const obsoleteKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));

  if (obsoleteKeys.length > 0) {
    throw new Error(
      `${path} has obsolete constraint ${obsoleteKeys.sort().join(", ")}`,
    );
  }
}

function fieldPath(parentPath: string, name: string) {
  return parentPath === "root" ? name : `${parentPath}.${name}`;
}
