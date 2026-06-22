import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const TEST_PASSWORD = "Correct-Horse-42";
const runner = path.join(__dirname, "fixture-runner.cjs");
function fixture(action: string, input = {}) {
  const output = execFileSync(process.execPath, [runner, action, JSON.stringify(input)], {
    encoding: "utf8",
  });
  return output ? JSON.parse(output) : undefined;
}

async function logIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Phase 1 project membership", () => {
  test.beforeEach(() => fixture("reset"));

  test("Viewer is read-only and Editor can mutate", async ({ page }) => {
    const owner = fixture("seed-user", { email: "owner@example.test", options: {} });
    const viewer = fixture("seed-user", { email: "viewer@example.test", options: {} });
    const editor = fixture("seed-user", { email: "editor@example.test", options: {} });
    const project = fixture("seed-project", { ownerId: owner.id });
    fixture("seed-membership", { projectId: project.id, userId: viewer.id, role: "VIEWER" });
    fixture("seed-membership", { projectId: project.id, userId: editor.id, role: "EDITOR" });

    await logIn(page, viewer.email);
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole("button", { name: "Add Field" })).toBeDisabled();

    await page.context().clearCookies();
    await logIn(page, editor.email);
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole("button", { name: "Add Field" })).toBeEnabled();
  });

  test("Owner manages members and cannot remove the last Owner", async ({ page }) => {
    const owner = fixture("seed-user", { email: "owner@example.test", options: {} });
    fixture("seed-user", { email: "viewer@example.test", options: {} });
    const project = fixture("seed-project", { ownerId: owner.id });
    await logIn(page, owner.email);
    await page.goto(`/projects/${project.id}/members`);

    await page.getByLabel("Member email").fill("viewer@example.test");
    await page.getByLabel("New member role").selectOption("VIEWER");
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("viewer@example.test")).toBeVisible();
    await expect(page.getByLabel("Role for owner@example.test")).toBeDisabled();
    await expect(page.getByText("Project must retain at least one owner")).toBeVisible();
  });
});
