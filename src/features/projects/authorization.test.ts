import { describe, expect, it } from "vitest";
import { can } from "./authorization";

describe("project authorization", () => {
  it.each([
    ["OWNER", "manage_members", true],
    ["EDITOR", "manage_members", false],
    ["EDITOR", "edit_schema", true],
    ["VIEWER", "edit_schema", false],
    ["VIEWER", "view_project", true],
  ] as const)("allows %s to %s = %s", (role, capability, expected) => {
    expect(can(role, capability)).toBe(expected);
  });
});
