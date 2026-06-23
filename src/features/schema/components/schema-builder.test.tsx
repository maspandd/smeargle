import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchemaBuilder } from "./schema-builder";

function renderBuilder(
  onAddField = vi.fn().mockResolvedValue({
    ok: true,
    versionId: "version-2",
    versionLabel: "v1.1",
    snapshot: {
      fields: [
        {
          id: "field-1",
          name: "product_name",
          type: "string",
          required: true,
          minLength: 3,
        },
      ],
    },
  }),
) {
  render(
    <SchemaBuilder
      initialSnapshot={{ fields: [] }}
      initialVersionId="version-1"
      initialVersionLabel="v1.0"
      onAddField={onAddField}
      projectId="project-1"
      readOnly={false}
    />,
  );
  return { onAddField };
}

describe("schema builder", () => {
  it("adds a String field and renders it in the field list", async () => {
    const user = userEvent.setup();
    const { onAddField } = renderBuilder();

    await user.click(screen.getByRole("button", { name: "Add Field" }));
    await user.type(screen.getByLabelText("Field name"), "product_name");
    await user.type(screen.getByLabelText("Minimum length"), "3");
    await user.click(screen.getByRole("button", { name: "Save Field" }));

    expect(onAddField).toHaveBeenCalledWith("project-1", "version-1", [], {
      name: "product_name",
      required: true,
      type: "string",
      minLength: 3,
    });
    expect(await screen.findByText("product_name")).toBeVisible();
    expect(screen.getByText("String")).toBeVisible();
    expect(screen.getByText("v1.1")).toBeVisible();
  });

  it("adds an Email semantic field and renders the LLM-Powered badge", async () => {
    const user = userEvent.setup();
    const onAddField = vi.fn().mockResolvedValue({
      ok: true,
      versionId: "version-2",
      versionLabel: "v1.1",
      snapshot: {
        fields: [
          {
            id: "field-1",
            name: "customer_email",
            type: "email",
            required: true,
          },
        ],
      },
    });
    renderBuilder(onAddField);

    await user.click(screen.getByRole("button", { name: "Add Field" }));
    await user.type(screen.getByLabelText("Field name"), "customer_email");
    await user.selectOptions(screen.getByLabelText("Field type"), "email");
    await user.click(screen.getByRole("button", { name: "Save Field" }));

    expect(await screen.findByText("customer_email")).toBeVisible();
    expect(screen.getByText("Email")).toBeVisible();
    expect(screen.getByText("LLM-Powered")).toBeVisible();
  });
});
