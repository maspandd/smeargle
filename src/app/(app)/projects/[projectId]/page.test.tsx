import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectWorkspace } from "./page";

describe("project workspace", () => {
  it("shows the empty Schema Builder with project context", () => {
    render(
      <ProjectWorkspace
        baseEndpoint="/api/products"
        currentSnapshot={{ fields: [] }}
        currentVersion="v1.0"
        currentVersionId="version-1"
        memberCount={1}
        name="Products API"
        projectId="project-1"
        role="OWNER"
      />,
    );

    expect(screen.getByRole("heading", { name: "Schema Builder" })).toBeVisible();
    expect(screen.getByText("/api/products")).toBeVisible();
    expect(screen.getAllByText("v1.0")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add Field" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/projects/project-1/members",
    );
  });
});
