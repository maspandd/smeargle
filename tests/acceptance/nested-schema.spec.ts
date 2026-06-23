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

test.describe("Phase 2 nested schema", () => {
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

  test("adds Object and Array fields and edits nested fields", async ({ page }) => {
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("address");
    await page.getByLabel("Field type").selectOption("object");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByText("address")).toBeVisible();
    await expect(page.getByText("Object", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("tags");
    await page.getByLabel("Field type").selectOption("array");
    await page.getByLabel("Item type").selectOption("string");
    await page.getByLabel("Item maximum length").fill("20");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByText("tags")).toBeVisible();
    await expect(page.getByText("Array", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Expand address" }).click();
    const group = page.getByRole("group", { name: "address fields" });
    await group.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("street");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByText("street")).toBeVisible();

    await page.getByRole("button", { name: "Collapse address" }).click();
    await expect(page.getByText("street")).toHaveCount(0);
  });
});
