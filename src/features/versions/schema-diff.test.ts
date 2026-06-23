import { describe, expect, it } from "vitest";
import { diffSchemas } from "./schema-diff";
import type { FieldDefinition, SchemaSnapshot } from "../schema/schema-types";

function snapshot(fields: FieldDefinition[]): SchemaSnapshot {
  return { fields };
}

describe("diffSchemas", () => {
  it("identifies added, deleted, renamed, reordered, and modified fields by stable ID", () => {
    const before = snapshot([
      {
        id: "fld_name",
        name: "name",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 80,
      },
      {
        id: "fld_price",
        name: "price",
        type: "number",
        required: true,
        min: 0,
        max: 100,
      },
      {
        id: "fld_description",
        name: "description",
        type: "string",
        required: false,
      },
    ]);
    const after = snapshot([
      {
        id: "fld_price",
        name: "price",
        type: "number",
        required: true,
        min: 0,
        max: 120,
      },
      {
        id: "fld_name",
        name: "product_name",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 80,
      },
      {
        id: "fld_stock",
        name: "in_stock",
        type: "boolean",
        required: true,
      },
    ]);

    expect(diffSchemas(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ADDED",
          fieldId: "fld_stock",
          pathBefore: null,
          pathAfter: "in_stock",
        }),
        expect.objectContaining({
          kind: "DELETED",
          fieldId: "fld_description",
          pathBefore: "description",
          pathAfter: null,
        }),
        expect.objectContaining({
          kind: "RENAMED",
          fieldId: "fld_name",
          pathBefore: "name",
          pathAfter: "product_name",
        }),
        expect.objectContaining({
          kind: "REORDERED",
          fieldId: "fld_name",
          pathBefore: "name",
          pathAfter: "product_name",
        }),
        expect.objectContaining({
          kind: "REORDERED",
          fieldId: "fld_price",
          pathBefore: "price",
          pathAfter: "price",
        }),
        expect.objectContaining({
          kind: "MODIFIED",
          fieldId: "fld_price",
          pathBefore: "price",
          pathAfter: "price",
        }),
      ]),
    );
  });

  it("includes nested field paths in recursive changes", () => {
    const before = snapshot([
      {
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
      },
    ]);
    const after = snapshot([
      {
        id: "fld_address",
        name: "address",
        type: "object",
        required: false,
        fields: [
          {
            id: "fld_city",
            name: "locality",
            type: "string",
            required: true,
          },
          {
            id: "fld_postal",
            name: "postal_code",
            type: "string",
            required: false,
          },
        ],
      },
    ]);

    expect(diffSchemas(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "RENAMED",
          fieldId: "fld_city",
          pathBefore: "address.city",
          pathAfter: "address.locality",
        }),
        expect.objectContaining({
          kind: "ADDED",
          fieldId: "fld_postal",
          pathBefore: null,
          pathAfter: "address.postal_code",
        }),
      ]),
    );
  });
});
