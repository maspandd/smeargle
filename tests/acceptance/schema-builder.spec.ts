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

test.describe("Phase 2 schema builder", () => {
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

  test("adds scalar fields and displays the Email semantic badge", async ({ page }) => {
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("product_name");
    await page.getByLabel("Minimum length").fill("3");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByText("product_name")).toBeVisible();
    await expect(page.getByText("String")).toBeVisible();
    await expect(page.getByText("v1.1")).toHaveCount(2);

    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("customer_email");
    await page.getByLabel("Field type").selectOption("email");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByText("customer_email")).toBeVisible();
    await expect(page.getByText("Email", { exact: true })).toBeVisible();
    await expect(page.getByText("LLM-Powered")).toBeVisible();
    await expect(page.getByText("v1.2")).toHaveCount(2);
  });
});
