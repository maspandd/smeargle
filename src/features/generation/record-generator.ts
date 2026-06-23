import type { FieldDefinition, SchemaSnapshot } from "@/features/schema/schema-types";
import { validateRecordValue } from "@/features/schema/value-validator";
import { createRandomSource } from "./random-source";
import { generateScalar } from "./scalar-generator";

export type GeneratedRecordValue = Record<string, unknown>;

export type GeneratedRecord = {
  id: string;
  value: GeneratedRecordValue;
};

export type GenerateRecordInput = {
  schema: SchemaSnapshot;
  seed: string;
  ordinal: number;
  nullRate: number;
};

export type GenerateRecordsInput = {
  schema: SchemaSnapshot;
  seed: string;
  count: number;
  nullRate: number;
};

type GenerationContext = {
  seed: string;
  ordinal: number;
  nullRate: number;
};

export function generateRecords(input: GenerateRecordsInput): GeneratedRecord[] {
  if (input.count < 0) {
    throw new Error("Record count cannot be negative");
  }

  return Array.from({ length: input.count }, (_, ordinal) =>
    generateRecord({
      schema: input.schema,
      seed: input.seed,
      ordinal,
      nullRate: input.nullRate,
    }),
  );
}

export function generateRecord(input: GenerateRecordInput): GeneratedRecord {
  assertNullRate(input.nullRate);

  const context: GenerationContext = {
    seed: input.seed,
    ordinal: input.ordinal,
    nullRate: input.nullRate,
  };
  const value = generateObjectFields(input.schema.fields, context, "root");
  const record = {
    id: createRecordId(input.seed, input.ordinal),
    value,
  };

  if (process.env.NODE_ENV !== "production") {
    const validation = validateRecordValue(input.schema, record.value);

    if (!validation.ok) {
      throw new Error(`Generated record is invalid: ${validation.errors.join("; ")}`);
    }
  }

  return record;
}

function generateObjectFields(
  fields: FieldDefinition[],
  context: GenerationContext,
  parentKey: string,
) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      generateField(field, context, `${parentKey}/${field.id}`),
    ]),
  );
}

function generateField(
  field: FieldDefinition,
  context: GenerationContext,
  stableKey: string,
): unknown {
  if (!field.required && shouldGenerateNull(context, stableKey)) {
    return null;
  }

  switch (field.type) {
    case "object":
      return generateObjectFields(field.fields, context, stableKey);
    case "array":
      return generateArray(field, context, stableKey);
    case "string":
    case "number":
    case "boolean":
    case "date":
    case "email":
      return generateScalar(
        field,
        createRandomSource(`${context.seed}:${context.ordinal}:${stableKey}:value`),
      );
  }
}

function generateArray(
  field: Extract<FieldDefinition, { type: "array" }>,
  context: GenerationContext,
  stableKey: string,
) {
  const random = createRandomSource(
    `${context.seed}:${context.ordinal}:${stableKey}:array`,
  );
  const minItems = field.minItems ?? (field.required ? 1 : 0);
  const maxItems = field.maxItems ?? Math.max(minItems, 3);
  const count = random.integer(minItems, maxItems);

  return Array.from({ length: count }, (_, index) =>
    generateField(field.item, context, `${stableKey}[${index}]/${field.item.id}`),
  );
}

function shouldGenerateNull(context: GenerationContext, stableKey: string) {
  if (context.nullRate <= 0) {
    return false;
  }
  if (context.nullRate >= 1) {
    return true;
  }

  return createRandomSource(
    `${context.seed}:${context.ordinal}:${stableKey}:null`,
  ).boolean(context.nullRate);
}

function createRecordId(seed: string, ordinal: number) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-".split("");
  const random = createRandomSource(`${seed}:${ordinal}:record-id`);
  let suffix = "";

  for (let index = 0; index < 24; index += 1) {
    suffix += random.pick(alphabet);
  }

  return `rec_${suffix}`;
}

function assertNullRate(nullRate: number) {
  if (!Number.isFinite(nullRate) || nullRate < 0 || nullRate > 1) {
    throw new Error("Null rate must be between 0 and 1");
  }
}
