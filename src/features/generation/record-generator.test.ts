import { describe, expect, it } from "vitest";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import { validateRecordValue } from "@/features/schema/value-validator";
import { generateRecord, generateRecords } from "./record-generator";

const recursiveSnapshot: SchemaSnapshot = {
  fields: [
    {
      id: "fld_product_name",
      name: "product_name",
      type: "string",
      required: true,
      minLength: 5,
      maxLength: 30,
    },
    {
      id: "fld_price",
      name: "price",
      type: "number",
      required: true,
      min: 1,
      max: 999.99,
      precision: 2,
    },
    {
      id: "fld_address",
      name: "address",
      type: "object",
      required: true,
      fields: [
        {
          id: "fld_street",
          name: "street",
          type: "string",
          required: true,
          minLength: 5,
          maxLength: 60,
        },
        {
          id: "fld_city",
          name: "city",
          type: "string",
          required: true,
          minLength: 2,
          maxLength: 40,
        },
        {
          id: "fld_postal_code",
          name: "postal_code",
          type: "string",
          required: false,
          minLength: 5,
          maxLength: 5,
        },
      ],
    },
    {
      id: "fld_tags",
      name: "tags",
      type: "array",
      required: true,
      minItems: 1,
      maxItems: 5,
      item: {
        id: "fld_tag",
        name: "tag",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 12,
      },
    },
    {
      id: "fld_customer_email",
      name: "customer_email",
      type: "email",
      required: false,
    },
  ],
};

const nullableSnapshot: SchemaSnapshot = {
  fields: [
    {
      id: "fld_required_name",
      name: "required_name",
      type: "string",
      required: true,
      minLength: 3,
      maxLength: 12,
    },
    {
      id: "fld_optional_price",
      name: "optional_price",
      type: "number",
      required: false,
      min: 1,
      max: 5,
      precision: 0,
    },
    {
      id: "fld_optional_address",
      name: "optional_address",
      type: "object",
      required: false,
      fields: [
        {
          id: "fld_required_city",
          name: "required_city",
          type: "string",
          required: true,
          minLength: 3,
          maxLength: 12,
        },
        {
          id: "fld_optional_postal_code",
          name: "optional_postal_code",
          type: "string",
          required: false,
          minLength: 5,
          maxLength: 5,
        },
      ],
    },
    {
      id: "fld_required_tags",
      name: "required_tags",
      type: "array",
      required: true,
      minItems: 2,
      maxItems: 2,
      item: {
        id: "fld_required_tag",
        name: "tag",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 8,
      },
    },
  ],
};

function reorderTopLevelFields(snapshot: SchemaSnapshot): SchemaSnapshot {
  return {
    fields: [
      snapshot.fields[3],
      snapshot.fields[0],
      snapshot.fields[4],
      snapshot.fields[1],
      snapshot.fields[2],
    ],
  };
}

function collectNullPaths(value: unknown, path = "record"): string[] {
  if (value === null) {
    return [path];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectNullPaths(item, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectNullPaths(child, path === "record" ? key : `${path}.${key}`),
    );
  }

  return [];
}

describe("record generator", () => {
  it("generates valid recursive records with stable non-null record ids", () => {
    const records = generateRecords({
      schema: recursiveSnapshot,
      count: 10,
      seed: "recursive-seed",
      nullRate: 0,
    });

    expect(records).toHaveLength(10);
    expect(new Set(records.map((record) => record.id)).size).toBe(10);

    for (const record of records) {
      expect(record.id).toMatch(/^rec_[A-Za-z0-9_-]{20,}$/);
      expect(record.value.address).toEqual(expect.any(Object));
      expect(record.value.tags).toEqual(expect.any(Array));
      expect((record.value.tags as unknown[]).length).toBeGreaterThanOrEqual(1);
      expect((record.value.tags as unknown[]).length).toBeLessThanOrEqual(5);
      expect(validateRecordValue(recursiveSnapshot, record.value)).toEqual({
        ok: true,
        errors: [],
      });
    }
  });

  it("keeps seeded field values stable when top-level field order changes", () => {
    const original = generateRecord({
      schema: recursiveSnapshot,
      ordinal: 3,
      seed: "stable-fields",
      nullRate: 0,
    });
    const reordered = generateRecord({
      schema: reorderTopLevelFields(recursiveSnapshot),
      ordinal: 3,
      seed: "stable-fields",
      nullRate: 0,
    });

    expect(reordered.id).toBe(original.id);
    expect(reordered.value).toEqual({
      tags: original.value.tags,
      product_name: original.value.product_name,
      customer_email: original.value.customer_email,
      price: original.value.price,
      address: original.value.address,
    });
  });

  it("applies a null rate of one only to non-required fields", () => {
    const record = generateRecord({
      schema: nullableSnapshot,
      ordinal: 0,
      seed: "all-nullable",
      nullRate: 1,
    });

    expect(record.value.required_name).not.toBeNull();
    expect(record.value.optional_price).toBeNull();
    expect(record.value.optional_address).toBeNull();
    expect(record.value.required_tags).toEqual(expect.any(Array));
    expect(validateRecordValue(nullableSnapshot, record.value)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("applies a null rate of zero by generating every field value", () => {
    const record = generateRecord({
      schema: nullableSnapshot,
      ordinal: 1,
      seed: "no-nulls",
      nullRate: 0,
    });

    expect(collectNullPaths(record.value)).toEqual([]);
    expect(validateRecordValue(nullableSnapshot, record.value)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("places middle-rate nulls deterministically for a fixed seed", () => {
    const first = generateRecords({
      schema: nullableSnapshot,
      count: 5,
      seed: "middle-nulls",
      nullRate: 0.5,
    });
    const second = generateRecords({
      schema: nullableSnapshot,
      count: 5,
      seed: "middle-nulls",
      nullRate: 0.5,
    });

    expect(first.map((record) => collectNullPaths(record.value))).toEqual(
      second.map((record) => collectNullPaths(record.value)),
    );
    expect(first.some((record) => collectNullPaths(record.value).length > 0)).toBe(
      true,
    );
  });
});
