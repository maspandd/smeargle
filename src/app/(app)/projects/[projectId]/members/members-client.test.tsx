import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MembersClient } from "./members-client";

const members = [
  { userId: "owner-1", email: "owner@example.test", role: "OWNER" as const },
  { userId: "editor-1", email: "editor@example.test", role: "EDITOR" as const },
];

function renderMembers(overrides = {}) {
  const props = {
    members,
    onAdd: vi.fn().mockResolvedValue(undefined),
    onChangeRole: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<MembersClient {...props} />);
  return props;
}

describe("members page", () => {
  it("adds an Editor by email", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderMembers();
    await user.type(screen.getByLabelText("Member email"), "new@example.test");
    await user.selectOptions(screen.getByLabelText("New member role"), "EDITOR");

    await user.click(screen.getByRole("button", { name: "Add member" }));

    expect(onAdd).toHaveBeenCalledWith({
      email: "new@example.test",
      role: "EDITOR",
    });
  });

  it("shows an empty search result", async () => {
    const user = userEvent.setup();
    renderMembers();

    await user.type(screen.getByLabelText("Search members"), "missing");

    expect(screen.getByText("No members match your search.")).toBeVisible();
  });

  it("changes a role and confirms removal", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onChangeRole, onRemove } = renderMembers();

    await user.selectOptions(
      screen.getByLabelText("Role for editor@example.test"),
      "VIEWER",
    );
    await user.click(
      screen.getByRole("button", { name: "Remove editor@example.test" }),
    );

    expect(onChangeRole).toHaveBeenCalledWith("editor-1", "VIEWER");
    expect(confirm).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith("editor-1");
    confirm.mockRestore();
  });

  it("disables controls that would remove the last Owner", () => {
    renderMembers({ members: [members[0]] });

    expect(screen.getByLabelText("Role for owner@example.test")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove owner@example.test" }),
    ).toBeDisabled();
    expect(screen.getAllByText("Project must retain at least one owner")).not.toHaveLength(0);
  });
});
