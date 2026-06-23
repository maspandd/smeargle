import { describe, expect, it } from "vitest";
import { parseSchema } from "./schema-parser";
import type { FieldDefinition, SchemaSnapshot } from "./schema-types";
import { addField, deleteField, editField, reorderField } from "./schema-mutations";

const productName = {
  id: "fld_product_name",
  name: "product_name",
  type: "string",
  required: true,
  minLength: 3,
  maxLength: 80,
} satisfies FieldDefinition;

const price = {
  id: "fld_price",
  name: "price",
  type: "number",
  required: true,
  min: 0,
  max: 9999,
  precision: 2,
} satisfies FieldDefinition;

const address = {
  id: "fld_address",
  name: "address",
  type: "object",
  required: false,
  fields: [
    {
      id: "fld_city",
      name: "city",
      type: "string",
      required: true,
    },
  ],
} satisfies FieldDefinition;

function baseSnapshot(): SchemaSnapshot {
  return parseSchema({
    fields: [productName, price, address],
  });
}

describe("schema mutations", () => {
  it("addField appends a String field without mutating the original snapshot", () => {
    const original = baseSnapshot();
    const next = addField(original, [], {
      id: "fld_description",
      name: "description",
      type: "string",
      required: false,
      maxLength: 240,
    });

    expect(next.fields.map((field) => field.id)).toEqual([
      "fld_product_name",
      "fld_price",
      "fld_address",
      "fld_description",
    ]);
    expect(original.fields.map((field) => field.id)).toEqual([
      "fld_product_name",
      "fld_price",
      "fld_address",
    ]);
  });

  it("addField rejects duplicate sibling names", () => {
    expect(() =>
      addField(baseSnapshot(), [], {
        id: "fld_duplicate",
        name: "product_name",
        type: "string",
        required: false,
      }),
    ).toThrow(/Duplicate field name at product_name/);
  });

  it("editField preserves field ID while changing label, type, and constraints", () => {
    const next = editField(baseSnapshot(), ["fld_price"], {
      id: "fld_price",
      name: "is_discounted",
      type: "boolean",
      required: false,
    });

    expect(next.fields[1]).toEqual({
      id: "fld_price",
      name: "is_discounted",
      type: "boolean",
      required: false,
    });
  });

  it("editField clears obsolete constraints when the field type changes", () => {
    const next = editField(baseSnapshot(), ["fld_product_name"], {
      id: "fld_product_name",
      name: "product_name",
      type: "number",
      required: true,
      min: 1,
      max: 999,
    });

    expect(next.fields[0]).toEqual({
      id: "fld_product_name",
      name: "product_name",
      type: "number",
      required: true,
      min: 1,
      max: 999,
    });
    expect(next.fields[0]).not.toHaveProperty("minLength");
    expect(next.fields[0]).not.toHaveProperty("maxLength");
  });

  it("deleteField removes a field by stable ID", () => {
    const next = deleteField(baseSnapshot(), ["fld_price"]);

    expect(next.fields.map((field) => field.id)).toEqual([
      "fld_product_name",
      "fld_address",
    ]);
  });

  it("reorderField changes order without changing IDs", () => {
    const next = reorderField(baseSnapshot(), [], "fld_address", 0);

    expect(next.fields.map((field) => field.id)).toEqual([
      "fld_address",
      "fld_product_name",
      "fld_price",
    ]);
  });

  it("mutates nested fields inside an Object", () => {
    const withStreet = addField(baseSnapshot(), ["fld_address"], {
      id: "fld_street",
      name: "street",
      type: "string",
      required: true,
    });
    const renamedStreet = editField(withStreet, ["fld_address", "fld_street"], {
      id: "fld_street",
      name: "street_name",
      type: "string",
      required: true,
      minLength: 3,
    });
    const withoutCity = deleteField(renamedStreet, ["fld_address", "fld_city"]);
    const objectField = withoutCity.fields.find(
      (field) => field.id === "fld_address",
    );

    expect(objectField).toEqual({
      id: "fld_address",
      name: "address",
      type: "object",
      required: false,
      fields: [
        {
          id: "fld_street",
          name: "street_name",
          type: "string",
          required: true,
          minLength: 3,
        },
      ],
    });
  });

  it("throws when the target field path does not exist", () => {
    expect(() =>
      editField(baseSnapshot(), ["fld_missing"], {
        id: "fld_missing",
        name: "missing",
        type: "string",
        required: false,
      }),
    ).toThrow(/Field path not found: fld_missing/);
  });
});
