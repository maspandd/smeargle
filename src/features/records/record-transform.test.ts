import { describe, expect, it } from "vitest";
import { deleteRecordKeys, renameRecordKeys } from "./record-transform";

describe("record transforms", () => {
  it("deletes nested keys from ten JSON records without touching unrelated content", () => {
    const records = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      address: {
        city: `City ${index + 1}`,
        postal_code: `10${index + 1}`,
      },
      active: index % 2 === 0,
    }));

    const transformed = deleteRecordKeys(records, [
      { fieldId: "fld_postal_code", path: "address.postal_code" },
    ]);

    expect(transformed).toHaveLength(10);
    expect(transformed[0]).toEqual({
      id: 1,
      address: { city: "City 1" },
      active: true,
    });
    expect(transformed[9]).toEqual({
      id: 10,
      address: { city: "City 10" },
      active: false,
    });
    expect(records[0].address).toHaveProperty("postal_code", "101");
  });

  it("renames a key without changing the rest of the record", () => {
    const records = [
      {
        id: 1,
        description: "Red shirt",
        price: 25,
      },
      {
        id: 2,
        description: "Blue jeans",
        price: 55,
      },
    ];

    const transformed = renameRecordKeys(records, [
      {
        fieldId: "fld_description",
        fromPath: "description",
        toPath: "summary",
      },
    ]);

    expect(transformed).toEqual([
      {
        id: 1,
        summary: "Red shirt",
        price: 25,
      },
      {
        id: 2,
        summary: "Blue jeans",
        price: 55,
      },
    ]);
    expect(records[0]).toHaveProperty("description", "Red shirt");
    expect(records[0]).not.toHaveProperty("summary");
  });
});
