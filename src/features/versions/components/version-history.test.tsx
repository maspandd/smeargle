import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VersionHistory } from "./version-history";

describe("version history", () => {
  it("lists versions newest first and displays actor, timestamp, label, and change summary", () => {
    render(
      <VersionHistory
        versions={[
          {
            id: "version-1",
            versionLabel: "v1.0",
            changeSummary: "Initial empty schema",
            actorLabel: "owner@example.test",
            createdAt: "2026-06-23T08:00:00.000Z",
            createdAtLabel: "2026-06-23 08:00 UTC",
            isCurrent: false,
          },
          {
            id: "version-3",
            versionLabel: "v1.2",
            changeSummary: "Added price field",
            actorLabel: "owner@example.test",
            createdAt: "2026-06-23T10:00:00.000Z",
            createdAtLabel: "2026-06-23 10:00 UTC",
            isCurrent: true,
          },
          {
            id: "version-2",
            versionLabel: "v1.1",
            changeSummary: "Added product_name field",
            actorLabel: "owner@example.test",
            createdAt: "2026-06-23T09:00:00.000Z",
            createdAtLabel: "2026-06-23 09:00 UTC",
            isCurrent: false,
          },
        ]}
      />,
    );

    const items = within(
      screen.getByRole("list", { name: "Schema version history" }),
    ).getAllByRole("listitem");

    expect(within(items[0]).getByRole("heading", { name: "v1.2" })).toBeVisible();
    expect(within(items[1]).getByRole("heading", { name: "v1.1" })).toBeVisible();
    expect(within(items[2]).getByRole("heading", { name: "v1.0" })).toBeVisible();
    expect(screen.getAllByText("owner@example.test")).toHaveLength(3);
    expect(screen.getByText("2026-06-23 10:00 UTC")).toBeVisible();
    expect(screen.getByText("Added price field")).toBeVisible();
    expect(screen.getByText("Current")).toBeVisible();
  });
});
