import { describe, expect, it } from "vitest";
import { createFieldId } from "./field-id";
import { parseSchema } from "./schema-parser";

describe("schema parser", () => {
  it("accepts a constrained String field", () => {
    const snapshot = parseSchema({
      fields: [
        {
          id: "fld_product_name",
          name: "product_name",
          type: "string",
          required: true,
          minLength: 3,
          maxLength: 80,
        },
      ],
    });

    expect(snapshot.fields).toEqual([
      {
        id: "fld_product_name",
        name: "product_name",
        type: "string",
        required: true,
        minLength: 3,
        maxLength: 80,
      },
    ]);
  });

  it("accepts a constrained Number field", () => {
    const snapshot = parseSchema({
      fields: [
        {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
          min: 0,
          max: 9999.99,
          precision: 2,
        },
      ],
    });

    expect(snapshot.fields[0]).toEqual({
      id: "fld_price",
      name: "price",
      type: "number",
      required: true,
      min: 0,
      max: 9999.99,
      precision: 2,
    });
  });

  it("accepts an Object with nested fields", () => {
    const snapshot = parseSchema({
      fields: [
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
          ],
        },
      ],
    });

    expect(snapshot.fields[0]).toEqual({
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
      ],
    });
  });

  it("accepts an Array with an item schema", () => {
    const snapshot = parseSchema({
      fields: [
        {
          id: "fld_variants",
          name: "variants",
          type: "array",
          required: false,
          minItems: 1,
          maxItems: 5,
          item: {
            id: "fld_variant",
            name: "variant",
            type: "object",
            required: true,
            fields: [
              {
                id: "fld_sku",
                name: "sku",
                type: "string",
                required: true,
              },
            ],
          },
        },
      ],
    });

    expect(snapshot.fields[0]).toEqual({
      id: "fld_variants",
      name: "variants",
      type: "array",
      required: false,
      minItems: 1,
      maxItems: 5,
      item: {
        id: "fld_variant",
        name: "variant",
        type: "object",
        required: true,
        fields: [
          {
            id: "fld_sku",
            name: "sku",
            type: "string",
            required: true,
          },
        ],
      },
    });
  });

  it("rejects duplicate sibling names", () => {
    expect(() =>
      parseSchema({
        fields: [
          { id: "fld_name", name: "name", type: "string", required: true },
          { id: "fld_name_2", name: "name", type: "number", required: false },
        ],
      }),
    ).toThrow(/Duplicate field name at name/);
  });

  it("rejects invalid min and max constraints", () => {
    expect(() =>
      parseSchema({
        fields: [
          {
            id: "fld_price",
            name: "price",
            type: "number",
            required: true,
            min: 100,
            max: 10,
          },
        ],
      }),
    ).toThrow(/price.*minimum cannot exceed maximum/);
  });

  it("rejects schemas deeper than five levels", () => {
    expect(() =>
      parseSchema({
        fields: [
          {
            id: "fld_l1",
            name: "level1",
            type: "object",
            required: true,
            fields: [
              {
                id: "fld_l2",
                name: "level2",
                type: "object",
                required: true,
                fields: [
                  {
                    id: "fld_l3",
                    name: "level3",
                    type: "object",
                    required: true,
                    fields: [
                      {
                        id: "fld_l4",
                        name: "level4",
                        type: "object",
                        required: true,
                        fields: [
                          {
                            id: "fld_l5",
                            name: "level5",
                            type: "object",
                            required: true,
                            fields: [
                              {
                                id: "fld_l6",
                                name: "level6",
                                type: "string",
                                required: true,
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/level1\.level2\.level3\.level4\.level5\.level6.*five levels/);
  });

  it("rejects more than 100 direct fields", () => {
    expect(() =>
      parseSchema({
        fields: Array.from({ length: 101 }, (_, index) => ({
          id: `fld_${index}`,
          name: `field_${index}`,
          type: "string",
          required: false,
        })),
      }),
    ).toThrow(/root.*100 direct fields/);
  });

  it("rejects obsolete constraints for the selected field type", () => {
    expect(() =>
      parseSchema({
        fields: [
          {
            id: "fld_available",
            name: "available",
            type: "boolean",
            required: true,
            minLength: 2,
          },
        ],
      }),
    ).toThrow(/available.*obsolete constraint.*minLength/);
  });
});

describe("field IDs", () => {
  it("creates stable-looking collision-resistant field IDs", () => {
    const first = createFieldId();
    const second = createFieldId();

    expect(first).toMatch(/^fld_[A-Za-z0-9_-]{20,}$/);
    expect(second).toMatch(/^fld_[A-Za-z0-9_-]{20,}$/);
    expect(first).not.toBe(second);
  });
});
