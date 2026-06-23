import { describe, expect, it } from "vitest";
import type { SchemaSnapshot } from "./schema-types";
import { validateRecordValue } from "./value-validator";

const recursiveSnapshot: SchemaSnapshot = {
  fields: [
    {
      id: "fld_product_name",
      name: "product_name",
      type: "string",
      required: true,
      minLength: 3,
      maxLength: 20,
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
          id: "fld_city",
          name: "city",
          type: "string",
          required: true,
          minLength: 2,
          maxLength: 80,
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
      required: false,
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
  ],
};

describe("record value validator", () => {
  it("accepts a recursive value that satisfies the schema snapshot", () => {
    expect(
      validateRecordValue(recursiveSnapshot, {
        product_name: "Laptop",
        price: 249.99,
        address: {
          city: "Jakarta",
          postal_code: "12345",
        },
        tags: ["promo", "local"],
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("reports nested type and constraint errors with stable paths", () => {
    expect(
      validateRecordValue(recursiveSnapshot, {
        product_name: "TV",
        price: 249.999,
        address: {
          city: "J",
          postal_code: "123456",
        },
        tags: ["ok", 42, "valid"],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "product_name must be at least 3 characters",
        "price must use at most 2 decimal places",
        "address.city must be at least 2 characters",
        "address.postal_code must be at most 5 characters",
        "tags[0] must be at least 3 characters",
        "tags[1] must be a string",
      ],
    });
  });

  it("allows null only for optional fields", () => {
    expect(
      validateRecordValue(recursiveSnapshot, {
        product_name: "Laptop",
        price: 249.99,
        address: {
          city: "Jakarta",
          postal_code: null,
        },
        tags: null,
      }),
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateRecordValue(recursiveSnapshot, {
        product_name: null,
        price: 249.99,
        address: null,
        tags: null,
      }),
    ).toEqual({
      ok: false,
      errors: [
        "product_name is required",
        "address is required",
      ],
    });
  });
});
