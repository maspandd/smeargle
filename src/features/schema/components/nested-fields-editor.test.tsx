import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "../schema-types";
import {
  NestedFieldsEditor,
  type AddFieldHandler,
} from "./nested-fields-editor";

function renderEditor(
  overrides: Partial<{
    fields: FieldDefinition[];
    parentFieldPath: string[];
    depth: number;
    readOnly: boolean;
    onAddField: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const onAddField = overrides.onAddField ?? vi.fn().mockResolvedValue(undefined);
  render(
    <NestedFieldsEditor
      depth={overrides.depth ?? 1}
      fields={overrides.fields ?? []}
      onAddField={onAddField as unknown as AddFieldHandler}
      parentFieldPath={overrides.parentFieldPath ?? []}
      readOnly={overrides.readOnly ?? false}
    />,
  );
  return { onAddField };
}

const addressField: FieldDefinition = {
  id: "fld_address",
  name: "address",
  type: "object",
  required: true,
  fields: [],
};

describe("nested fields editor", () => {
  it("adds an Object field", async () => {
    const user = userEvent.setup();
    const { onAddField } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Add Field" }));
    await user.type(screen.getByLabelText("Field name"), "address");
    await user.selectOptions(screen.getByLabelText("Field type"), "object");
    await user.click(screen.getByRole("button", { name: "Save Field" }));

    expect(onAddField).toHaveBeenCalledWith([], {
      name: "address",
      type: "object",
      required: true,
    });
  });

  it("adds a nested String field under an Object", async () => {
    const user = userEvent.setup();
    const { onAddField } = renderEditor({ fields: [addressField] });

    await user.click(screen.getByRole("button", { name: "Expand address" }));
    const group = screen.getByRole("group", { name: "address fields" });
    await user.click(within(group).getByRole("button", { name: "Add Field" }));
    await user.type(screen.getByLabelText("Field name"), "street");
    await user.click(screen.getByRole("button", { name: "Save Field" }));

    expect(onAddField).toHaveBeenCalledWith(["fld_address"], {
      name: "street",
      type: "string",
      required: true,
    });
  });

  it("expands and collapses an Object row", async () => {
    const user = userEvent.setup();
    renderEditor({
      fields: [
        {
          ...addressField,
          fields: [
            { id: "fld_street", name: "street", type: "string", required: true },
          ],
        },
      ],
    });

    expect(screen.queryByText("street")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand address" }));
    expect(screen.getByText("street")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Collapse address" }));
    expect(screen.queryByText("street")).not.toBeInTheDocument();
  });

  it("adds an Array field with a constrained item schema", async () => {
    const user = userEvent.setup();
    const { onAddField } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Add Field" }));
    await user.type(screen.getByLabelText("Field name"), "tags");
    await user.selectOptions(screen.getByLabelText("Field type"), "array");
    await user.selectOptions(screen.getByLabelText("Item type"), "string");
    await user.type(screen.getByLabelText("Item maximum length"), "20");
    await user.click(screen.getByRole("button", { name: "Save Field" }));

    expect(onAddField).toHaveBeenCalledWith([], {
      name: "tags",
      type: "array",
      required: true,
      item: { type: "string", maxLength: 20 },
    });
  });

  it("disables adding fields beyond the maximum nesting depth", () => {
    renderEditor({ depth: 6, parentFieldPath: ["a", "b", "c", "d", "e"] });

    expect(screen.getByRole("button", { name: "Add Field" })).toBeDisabled();
  });

  it("disables adding more than 100 direct fields", () => {
    const fields: FieldDefinition[] = Array.from({ length: 100 }, (_, index) => ({
      id: `fld_${index}`,
      name: `field_${index}`,
      type: "string",
      required: false,
    }));
    renderEditor({ fields });

    expect(screen.getByRole("button", { name: "Add Field" })).toBeDisabled();
  });
});
