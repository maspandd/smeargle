import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectWorkspace } from "./page";

describe("project workspace", () => {
  it("shows the empty Schema Builder with project context", () => {
    render(
      <ProjectWorkspace
        baseEndpoint="/api/products"
        currentVersion="v1.0"
        memberCount={1}
        name="Products API"
        role="OWNER"
      />,
    );

    expect(screen.getByRole("heading", { name: "Schema Builder" })).toBeVisible();
    expect(screen.getByText("/api/products")).toBeVisible();
    expect(screen.getByText("v1.0")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add Field" })).toBeVisible();
  });
});
