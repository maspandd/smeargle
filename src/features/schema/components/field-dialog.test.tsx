import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FieldDialog } from "./field-dialog";

function renderDialog() {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<FieldDialog onClose={onClose} onSubmit={onSubmit} open />);
  return { onClose, onSubmit };
}

describe("field dialog", () => {
  it("shows String constraints when String is selected", () => {
    renderDialog();

    expect(screen.getByLabelText("Minimum length")).toBeVisible();
    expect(screen.getByLabelText("Maximum length")).toBeVisible();
  });

  it("shows Number constraints when Number is selected", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText("Field type"), "number");

    expect(screen.getByLabelText("Minimum value")).toBeVisible();
    expect(screen.getByLabelText("Maximum value")).toBeVisible();
    expect(screen.getByLabelText("Decimal precision")).toBeVisible();
  });

  it("shows Date constraints when Date is selected", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText("Field type"), "date");

    expect(screen.getByLabelText("Earliest date")).toBeVisible();
    expect(screen.getByLabelText("Latest date")).toBeVisible();
  });

  it("removes obsolete controls when the field type changes", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByLabelText("Minimum length")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Field type"), "number");

    expect(screen.queryByLabelText("Minimum length")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Minimum value")).toBeVisible();
  });
});
