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

test.describe("Phase 1 project creation", () => {
  test.beforeEach(async ({ page }) => {
    fixture("reset");
    fixture("seed-user", { email: "owner@example.test", options: {} });
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("AC-01.01 creates v1.0 and opens the empty schema workspace", async ({ page }) => {
    await page.getByRole("button", { name: "Create First Mock API" }).click();
    await page.getByLabel("Project name").fill("Products API");
    await page.getByLabel("Base endpoint").fill("/api/products/");
    await page.getByRole("button", { name: "Save Project" }).click();

    await expect(page).toHaveURL(/\/projects\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Schema Builder" })).toBeVisible();
    await expect(page.getByText("v1.0", { exact: true })).toHaveCount(2);
  });

  test("AC-01.02 keeps the dialog open for a blank project name", async ({ page }) => {
    await page.getByRole("button", { name: "Create First Mock API" }).click();
    await page.getByRole("button", { name: "Save Project" }).click();

    await expect(page.getByText("Project name is required")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("AC-01.03 rejects an endpoint without a leading slash", async ({ page }) => {
    await page.getByRole("button", { name: "Create First Mock API" }).click();
    await page.getByLabel("Project name").fill("Products API");
    await page.getByLabel("Base endpoint").fill("api/products");
    await page.getByRole("button", { name: "Save Project" }).click();

    await expect(page.getByText("Endpoint must start with /")).toBeVisible();
  });

  test("AC-01.04 cancels without persistence", async ({ page }) => {
    await page.getByRole("button", { name: "Create First Mock API" }).click();
    await page.getByLabel("Project name").fill("Products API");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(() => fixture("count-projects")).toBe(0);
  });
});
