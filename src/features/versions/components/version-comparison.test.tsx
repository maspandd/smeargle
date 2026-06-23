import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SchemaChange } from "../schema-diff";
import { VersionComparison } from "./version-comparison";

const changes: SchemaChange[] = [
  {
    kind: "ADDED",
    fieldId: "fld_stock",
    pathBefore: null,
    pathAfter: "in_stock",
    before: null,
    after: {
      id: "fld_stock",
      name: "in_stock",
      type: "boolean",
      required: true,
    },
  },
  {
    kind: "DELETED",
    fieldId: "fld_description",
    pathBefore: "description",
    pathAfter: null,
    before: {
      id: "fld_description",
      name: "description",
      type: "string",
      required: false,
    },
    after: null,
  },
  {
    kind: "MODIFIED",
    fieldId: "fld_price",
    pathBefore: "price",
    pathAfter: "price",
    before: {
      id: "fld_price",
      name: "price",
      type: "number",
      required: true,
      max: 100,
    },
    after: {
      id: "fld_price",
      name: "price",
      type: "number",
      required: true,
      max: 120,
    },
  },
];

describe("version comparison", () => {
  it("shows textual added, deleted, and modified states instead of relying on color only", () => {
    render(
      <VersionComparison
        afterVersionLabel="v1.2"
        beforeVersionLabel="v1.1"
        changes={changes}
      />,
    );

    expect(screen.getByRole("heading", { name: "Comparing v1.2 to v1.1" })).toBeVisible();
    expect(screen.getByText("Added", { exact: true })).toBeVisible();
    expect(screen.getByText("Deleted", { exact: true })).toBeVisible();
    expect(screen.getByText("Modified", { exact: true })).toBeVisible();
    expect(screen.getByText("in_stock")).toBeVisible();
    expect(screen.getByText("description")).toBeVisible();
    expect(screen.getAllByText("price")).not.toHaveLength(0);
  });
});
