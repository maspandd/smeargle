import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "./create-project-dialog";

function renderDialog() {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <CreateProjectDialog onClose={onClose} onSubmit={onSubmit} open />,
  );
  return { onClose, onSubmit };
}

describe("create project dialog", () => {
  it("shows the required-name error and focuses the name field", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    expect(screen.getByText("Project name is required")).toBeVisible();
    expect(screen.getByLabelText("Project name")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the leading-slash endpoint error", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.type(screen.getByLabelText("Project name"), "Products API");
    await user.type(screen.getByLabelText("Base endpoint"), "api/products");

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    expect(screen.getByText("Endpoint must start with /")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels without submitting", async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("dismisses from the overlay without submitting", async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Dismiss create project dialog" }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized project values", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.type(screen.getByLabelText("Project name"), "  Products API  ");
    await user.type(screen.getByLabelText("Base endpoint"), "//api///products/");

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Products API",
      baseEndpoint: "/api/products",
    });
  });
});
