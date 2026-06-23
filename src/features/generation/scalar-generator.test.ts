import { describe, expect, it } from "vitest";
import { createRandomSource } from "./random-source";
import {
  generateScalar,
  type ScalarFieldDefinition,
} from "./scalar-generator";

const scalarFields: ScalarFieldDefinition[] = [
  {
    id: "fld_product_name",
    name: "product_name",
    type: "string",
    required: true,
    minLength: 4,
    maxLength: 18,
  },
  {
    id: "fld_price",
    name: "price",
    type: "number",
    required: true,
    min: 10,
    max: 99.99,
    precision: 2,
  },
  {
    id: "fld_available",
    name: "available",
    type: "boolean",
    required: true,
  },
  {
    id: "fld_released_on",
    name: "released_on",
    type: "date",
    required: true,
    minDate: "2026-01-01",
    maxDate: "2026-01-31",
  },
  {
    id: "fld_customer_email",
    name: "customer_email",
    type: "email",
    required: true,
  },
  {
    id: "fld_customer_name",
    name: "customer_name",
    type: "personName",
    required: true,
  },
  {
    id: "fld_catalog_item",
    name: "catalog_item",
    type: "productName",
    required: true,
  },
  {
    id: "fld_shipping_address",
    name: "shipping_address",
    type: "address",
    required: true,
  },
];

function generatedSequence(seed: string) {
  const random = createRandomSource(seed);

  return scalarFields.map((field) => ({
    type: field.type,
    values: Array.from({ length: 5 }, () => generateScalar(field, random)),
  }));
}

describe("random source", () => {
  it("owns deterministic helper and Indonesian faker sequences per seed", () => {
    const first = createRandomSource("seed-123");
    const second = createRandomSource("seed-123");

    expect([
      first.integer(1, 10),
      first.float(1, 2),
      first.boolean(),
      first.pick(["alpha", "beta", "gamma"]),
      first
        .date(
          new Date("2026-01-01T00:00:00.000Z"),
          new Date("2026-01-03T00:00:00.000Z"),
        )
        .toISOString(),
      first.faker.location.city(),
    ]).toEqual([
      second.integer(1, 10),
      second.float(1, 2),
      second.boolean(),
      second.pick(["alpha", "beta", "gamma"]),
      second
        .date(
          new Date("2026-01-01T00:00:00.000Z"),
          new Date("2026-01-03T00:00:00.000Z"),
        )
        .toISOString(),
      second.faker.location.city(),
    ]);
  });
});

describe("scalar generator", () => {
  it("generates repeatable scalar sequences for one seed", () => {
    expect(generatedSequence("seed-123")).toEqual(generatedSequence("seed-123"));
    expect(generatedSequence("seed-123")).not.toEqual(
      generatedSequence("seed-456"),
    );
  });

  it("always satisfies string length constraints", () => {
    const field: ScalarFieldDefinition = {
      id: "fld_name",
      name: "name",
      type: "string",
      required: true,
      minLength: 5,
      maxLength: 12,
    };
    const random = createRandomSource("string-constraints");

    for (let index = 0; index < 1_000; index += 1) {
      const value = generateScalar(field, random);

      expect(typeof value).toBe("string");
      expect(String(value).length).toBeGreaterThanOrEqual(5);
      expect(String(value).length).toBeLessThanOrEqual(12);
    }
  });

  it("always satisfies numeric range and decimal precision constraints", () => {
    const field: ScalarFieldDefinition = {
      id: "fld_price",
      name: "price",
      type: "number",
      required: true,
      min: -5,
      max: 5,
      precision: 2,
    };
    const random = createRandomSource("number-constraints");

    for (let index = 0; index < 1_000; index += 1) {
      const value = generateScalar(field, random);

      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThanOrEqual(5);
      expect(Number(Number(value).toFixed(2))).toBe(value);
    }

    expect(
      generateScalar(
        { ...field, min: 7.25, max: 7.25 },
        createRandomSource("number-inclusive"),
      ),
    ).toBe(7.25);
  });

  it("always satisfies inclusive UTC date constraints", () => {
    const field: ScalarFieldDefinition = {
      id: "fld_available_on",
      name: "available_on",
      type: "date",
      required: true,
      minDate: "2026-02-01",
      maxDate: "2026-02-07",
    };
    const min = Date.parse("2026-02-01T00:00:00.000Z");
    const max = Date.parse("2026-02-07T00:00:00.000Z");
    const random = createRandomSource("date-constraints");

    for (let index = 0; index < 1_000; index += 1) {
      const value = generateScalar(field, random);

      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const timestamp = Date.parse(`${value}T00:00:00.000Z`);
      expect(timestamp).toBeGreaterThanOrEqual(min);
      expect(timestamp).toBeLessThanOrEqual(max);
    }

    expect(
      generateScalar(
        { ...field, minDate: "2026-03-14", maxDate: "2026-03-14" },
        createRandomSource("date-inclusive"),
      ),
    ).toBe("2026-03-14");
  });

  it("generates non-empty semantic values for email, person, product, and address fields", () => {
    const random = createRandomSource("semantic-fields");

    expect(generateScalar(scalarFields[4], random)).toMatch(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    );
    expect(generateScalar(scalarFields[5], random)).toEqual(expect.any(String));
    expect(generateScalar(scalarFields[6], random)).toEqual(expect.any(String));
    expect(generateScalar(scalarFields[7], random)).toEqual(expect.any(String));
    expect(String(generateScalar(scalarFields[5], random)).trim()).not.toBe("");
    expect(String(generateScalar(scalarFields[6], random)).trim()).not.toBe("");
    expect(String(generateScalar(scalarFields[7], random)).trim()).not.toBe("");
  });
});
