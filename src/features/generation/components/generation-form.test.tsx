import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  GenerationForm,
  type GenerationFormAction,
} from "./generation-form";

function renderForm(
  action: GenerationFormAction = vi.fn().mockResolvedValue({
    ok: true,
    jobId: "job-1",
    seed: "seed-123",
  }),
  options?: {
    schemaEmpty?: boolean;
    readOnly?: boolean;
  },
) {
  render(
    <GenerationForm
      action={action}
      endpoint="/api/products"
      projectId="project-1"
      readOnly={options?.readOnly ?? false}
      schemaEmpty={options?.schemaEmpty ?? false}
    />,
  );

  return { action };
}

describe("generation form", () => {
  it("shows the record count, null percentage, and dynamic generate label", async () => {
    const user = userEvent.setup();
    renderForm();

    const count = screen.getByLabelText("Number of records");
    expect(count).toHaveValue(10);
    expect(
      screen.getByRole("button", { name: "Generate 10 Records" }),
    ).toBeVisible();

    await user.clear(count);
    await user.type(count, "25");
    expect(
      screen.getByRole("button", { name: "Generate 25 Records" }),
    ).toBeVisible();

    const nullPercentage = screen.getByLabelText("Null percentage");
    await user.clear(nullPercentage);
    await user.type(nullPercentage, "20");
    expect(screen.getByText("20% of optional values may be null.")).toBeVisible();
  });

  it("shows the server count error and preserves submitted values", async () => {
    const user = userEvent.setup();
    const action = vi.fn<GenerationFormAction>().mockResolvedValue({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { count: "Please specify number of records" },
    });
    renderForm(action);

    const count = screen.getByLabelText("Number of records");
    await user.clear(count);
    await user.type(screen.getByLabelText("Seed"), "catalog-seed");
    await user.click(screen.getByRole("button", { name: "Generate Records" }));

    expect(
      await screen.findByText("Please specify number of records"),
    ).toBeVisible();
    expect(screen.getByLabelText("Seed")).toHaveValue("catalog-seed");
    expect(action).toHaveBeenCalledWith("project-1", {
      confirmedReplacement: false,
      count: "",
      mode: "FAKER_ONLY",
      nullPercentage: "0",
      seed: "catalog-seed",
    });
  });

  it("blocks generation and announces an empty schema", () => {
    renderForm(undefined, { schemaEmpty: true });

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Add at least one schema field before generating records");
    expect(
      screen.getByRole("button", { name: "Generate 10 Records" }),
    ).toBeDisabled();
  });

  it("warns that hybrid generation can fall back to faker values", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Generation mode"), "HYBRID_LLM");

    expect(
      screen.getByText(
        "LLM enrichment may fall back to deterministic faker values.",
      ),
    ).toBeVisible();
  });

  it("disables duplicate submission while the job is being created", async () => {
    const user = userEvent.setup();
    let resolveAction:
      | ((result: Awaited<ReturnType<GenerationFormAction>>) => void)
      | undefined;
    const action = vi.fn<GenerationFormAction>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderForm(action);

    await user.click(screen.getByRole("button", { name: "Generate 10 Records" }));

    expect(
      screen.getByRole("button", { name: "Starting generation..." }),
    ).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();

    resolveAction?.({ ok: true, jobId: "job-1", seed: "seed-123" });
  });

  it("names the exact replacement count and confirms with the same values", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn<GenerationFormAction>()
      .mockResolvedValueOnce({
        ok: false,
        code: "REPLACEMENT_CONFIRMATION_REQUIRED",
        existingRecordCount: 12,
      })
      .mockResolvedValueOnce({
        ok: true,
        jobId: "job-1",
        seed: "seed-123",
      });
    renderForm(action);

    await user.click(screen.getByRole("button", { name: "Generate 10 Records" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Replace existing records",
    });
    expect(dialog).toHaveTextContent(
      "Replace 12 existing records? The current dataset remains available until generation completes.",
    );

    await user.click(
      screen.getByRole("button", { name: "Replace 12 Records" }),
    );

    expect(action).toHaveBeenLastCalledWith("project-1", {
      confirmedReplacement: true,
      count: "10",
      mode: "FAKER_ONLY",
      nullPercentage: "0",
      seed: "",
    });
  });
});
