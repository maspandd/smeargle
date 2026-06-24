import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataPreview } from "./data-preview";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import type { MockRecord } from "@prisma/client";

const mockSchema: SchemaSnapshot = {
  fields: [
    { id: "f1", name: "id", type: "string", required: true },
    { id: "f2", name: "status", type: "string", required: false },
    { id: "f3", name: "metadata", type: "object", required: true, fields: [] },
    { id: "f4", name: "tags", type: "array", required: true, item: { id: "f4_item", name: "item", type: "string", required: true } },
  ],
};

const mockRecords = [
  {
    id: "rec_1",
    projectId: "proj_1",
    schemaVersionId: "ver_1",
    generationJobId: null,
    ordinal: 0,
    source: "GENERATED",
    createdAt: new Date(),
    value: {
      id: "usr_123",
      status: null,
      metadata: { role: "admin", visits: 42 },
      tags: ["vip", "beta"],
    },
  } as MockRecord,
];

describe("DataPreview", () => {
  it("renders count and all schema columns", () => {
    render(<DataPreview schema={mockSchema} records={mockRecords} totalCount={10} page={1} pageSize={10} />);

    expect(screen.getByText("Showing 1 of 10 records")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "id" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "status" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "metadata" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "tags" })).toBeVisible();
  });

  it("renders gray/italic null for null values", () => {
    render(<DataPreview schema={mockSchema} records={mockRecords} totalCount={10} page={1} pageSize={10} />);

    const nullSpan = screen.getByText("null");
    expect(nullSpan).toBeVisible();
    expect(nullSpan).toHaveClass("text-zinc-400", "italic");
  });

  it("renders expandable Object JSON and Array JSON", async () => {
    const user = userEvent.setup();
    render(<DataPreview schema={mockSchema} records={mockRecords} totalCount={10} page={1} pageSize={10} />);

    const metadataDisclosure = screen.getByText("{ ... }");
    expect(screen.queryByText(/"role":\s*"admin"/)).not.toBeVisible();
    
    await user.click(metadataDisclosure);
    expect(screen.getByText(/"role":\s*"admin"/)).toBeVisible();

    const tagsDisclosure = screen.getByText("[ ... ]");
    expect(screen.queryByText(/"vip"/)).not.toBeVisible();
    
    await user.click(tagsDisclosure);
    expect(screen.getByText(/"vip"/)).toBeVisible();
  });
});
