import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardClient } from "./dashboard-client";

describe("dashboard", () => {
  it("opens project creation from the empty state", async () => {
    const user = userEvent.setup();
    render(<DashboardClient createProject={vi.fn()} projects={[]} />);

    await user.click(
      screen.getByRole("button", { name: "Create First Mock API" }),
    );

    expect(screen.getByRole("dialog", { name: "Create a mock API" })).toBeVisible();
  });

  it("lists accessible projects with endpoint, role, and version", () => {
    render(
      <DashboardClient
        createProject={vi.fn()}
        projects={[
          {
            id: "project-1",
            name: "Products API",
            baseEndpoint: "/api/products",
            role: "EDITOR",
            currentVersion: "v1.0",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /Products API/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(screen.getByText("/api/products")).toBeVisible();
    expect(screen.getByText("Editor")).toBeVisible();
    expect(screen.getByText("v1.0")).toHaveClass("bg-blue-600");
  });
});
