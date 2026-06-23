import { describe, expect, it } from "vitest";
import { classifySchemaChange } from "./compatibility";
import type { FieldDefinition, SchemaSnapshot } from "./schema-types";

function snapshot(fields: FieldDefinition[]): SchemaSnapshot {
  return { fields };
}

describe("classifySchemaChange", () => {
  it("marks an optional field add as COMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([]),
      snapshot([
        {
          id: "fld_nickname",
          name: "nickname",
          type: "string",
          required: false,
        },
      ]),
    );

    expect(result).toEqual({
      kind: "COMPATIBLE",
      operation: "NONE",
      affectedFieldIds: [],
      affectedPaths: [],
      deletions: [],
      renames: [],
      warning: null,
    });
  });

  it("marks widened String constraints as COMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_name",
          name: "name",
          type: "string",
          required: true,
          minLength: 3,
          maxLength: 20,
        },
      ]),
      snapshot([
        {
          id: "fld_name",
          name: "name",
          type: "string",
          required: true,
          minLength: 1,
          maxLength: 40,
        },
      ]),
    );

    expect(result.kind).toBe("COMPATIBLE");
  });

  it("marks widened Number constraints as COMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
          min: 0,
          max: 100,
          precision: 2,
        },
      ]),
      snapshot([
        {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
          min: -10,
          max: 250,
          precision: 4,
        },
      ]),
    );

    expect(result.kind).toBe("COMPATIBLE");
  });

  it("marks a field deletion as TRANSFORMABLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_description",
          name: "description",
          type: "string",
          required: false,
        },
      ]),
      snapshot([]),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "TRANSFORMABLE",
        operation: "DELETE_KEYS",
        affectedFieldIds: ["fld_description"],
        affectedPaths: ["description"],
        deletions: [{ fieldId: "fld_description", path: "description" }],
      }),
    );
  });

  it("marks a field rename as TRANSFORMABLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_description",
          name: "description",
          type: "string",
          required: false,
        },
      ]),
      snapshot([
        {
          id: "fld_description",
          name: "summary",
          type: "string",
          required: false,
        },
      ]),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "TRANSFORMABLE",
        operation: "RENAME_KEYS",
        affectedFieldIds: ["fld_description"],
        renames: [
          {
            fieldId: "fld_description",
            fromPath: "description",
            toPath: "summary",
          },
        ],
      }),
    );
  });

  it("marks a required field add as INCOMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([]),
      snapshot([
        {
          id: "fld_price",
          name: "price",
          type: "number",
          required: true,
        },
      ]),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "INCOMPATIBLE",
        operation: "REGENERATE_RECORDS",
        affectedFieldIds: ["fld_price"],
        affectedPaths: ["price"],
      }),
    );
  });

  it("marks narrowed constraints as INCOMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_name",
          name: "name",
          type: "string",
          required: true,
          minLength: 1,
          maxLength: 50,
        },
      ]),
      snapshot([
        {
          id: "fld_name",
          name: "name",
          type: "string",
          required: true,
          minLength: 5,
          maxLength: 10,
        },
      ]),
    );

    expect(result.kind).toBe("INCOMPATIBLE");
  });

  it("marks type changes as INCOMPATIBLE", () => {
    const result = classifySchemaChange(
      snapshot([
        {
          id: "fld_value",
          name: "value",
          type: "string",
          required: true,
        },
      ]),
      snapshot([
        {
          id: "fld_value",
          name: "value",
          type: "number",
          required: true,
        },
      ]),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "INCOMPATIBLE",
        operation: "REGENERATE_RECORDS",
        affectedFieldIds: ["fld_value"],
        affectedPaths: ["value"],
      }),
    );
  });
});
