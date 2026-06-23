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

test.describe("Phase 2 schema versions", () => {
  test.beforeEach(async ({ page }) => {
    fixture("reset");
    fixture("seed-user", { email: "owner@example.test", options: {} });
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("button", { name: "Create First Mock API" }).click();
    await page.getByLabel("Project name").fill("Products API");
    await page.getByLabel("Base endpoint").fill("/api/products");
    await page.getByRole("button", { name: "Save Project" }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  });

  test("shows version history and compares the latest two schema versions", async ({ page }) => {
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("product_name");
    await page.getByRole("button", { name: "Save Field" }).click();

    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("price");
    await page.getByLabel("Field type").selectOption("number");
    await page.getByRole("button", { name: "Save Field" }).click();

    const projectUrl = page.url();
    await page.goto(`${projectUrl}/versions`);

    await expect(page.getByRole("heading", { name: "Schema Versions" })).toBeVisible();
    const history = page.getByRole("list", { name: "Schema version history" });
    await expect(history.getByRole("heading", { name: "v1.2" })).toBeVisible();
    await expect(history.getByRole("heading", { name: "v1.1" })).toBeVisible();
    await expect(history.getByRole("heading", { name: "v1.0" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparing v1.2 to v1.1" })).toBeVisible();
    await expect(page.getByText("Added", { exact: true })).toBeVisible();
    await expect(page.getByText("price", { exact: true })).toBeVisible();
  });
});
