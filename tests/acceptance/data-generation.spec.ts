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

test.describe("Phase 3 data generation", () => {
  let projectId: string;

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
    await expect(page).toHaveURL(/\/projects\/([^/]+)$/);

    const url = page.url();
    projectId = url.split("/").pop() || "";
  });

  test("rejects generation for an empty schema (AC-03.04)", async ({ page }) => {
    await page.goto(`/projects/${projectId}/data`);
    await expect(page.getByText("Add at least one schema field before generating records")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate 10 Records" })).toBeDisabled();
  });

  test.describe("with schema", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/projects/${projectId}`);
      // Add product_name
      await page.getByRole("button", { name: "Add Field" }).click();
      await page.getByLabel("Field name").fill("product_name");
      await page.getByRole("button", { name: "Save Field" }).click();

      // Add status
      await page.getByRole("button", { name: "Add Field" }).click();
      await page.getByLabel("Field name").fill("status");
      await page.getByLabel("Required").uncheck();
      await page.getByRole("button", { name: "Save Field" }).click();

      await page.goto(`/projects/${projectId}/data`);
    });

    test("rejects a missing record count (AC-03.03)", async ({ page }) => {
      await page.getByLabel("Number of records").fill("");
      await page.getByRole("button", { name: "Generate Records" }).click();
      await expect(page.getByText("Please specify number of records")).toBeVisible();
    });

    test("generates ten complete non-null records and previews them (AC-03.01)", async ({ page }) => {
      await page.getByLabel("Number of records").fill("10");
      await page.getByLabel("Null percentage").fill("0");
      await page.getByRole("button", { name: "Generate 10 Records" }).click();

      // Wait for success
      await expect(page.getByText("Showing 1 of 10 records")).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("columnheader", { name: "product_name" })).toBeVisible();
      
      // Since null rate is 0, status shouldn't be null
      const cells = await page.getByRole("cell").allTextContents();
      expect(cells.includes("null")).toBeFalsy();
    });

    test("generates records using the configured null policy and renders null accessibly (AC-03.02)", async ({ page }) => {
      await page.getByLabel("Number of records").fill("10");
      await page.getByLabel("Null percentage").fill("100"); // 100% null rate
      await page.getByRole("button", { name: "Generate 10 Records" }).click();

      await expect(page.getByText("Showing 1 of 10 records")).toBeVisible({ timeout: 10000 });
      
      // Null cells should be visible and rendered correctly
      const nullCells = page.getByText("null", { exact: true });
      await expect(nullCells.first()).toBeVisible();
    });

    test("asks before replacing an existing dataset and atomically replaces (AC-03.05, AC-03.06)", async ({ page }) => {
      // Generate first dataset
      await page.getByLabel("Number of records").fill("10");
      await page.getByLabel("Seed").fill("first-seed");
      await page.getByRole("button", { name: "Generate 10 Records" }).click();
      await expect(page.getByText("Showing 1 of 10 records")).toBeVisible({ timeout: 10000 });

      // Generate second dataset
      await page.getByLabel("Number of records").fill("5");
      await page.getByLabel("Seed").fill("second-seed");
      await page.getByRole("button", { name: "Generate 5 Records" }).click();

      // Should show confirmation
      await expect(page.getByText("Replace 10 existing records?")).toBeVisible();
      
      // Confirm replacement
      await page.getByRole("button", { name: "Replace 10 Records" }).click();

      // Should show new dataset
      await expect(page.getByText("Showing 1 of 5 records")).toBeVisible({ timeout: 10000 });
    });

    test("seed reproducibility", async ({ page }) => {
      // First run
      await page.getByLabel("Number of records").fill("5");
      await page.getByLabel("Seed").fill("repro-seed");
      await page.getByRole("button", { name: "Generate 5 Records" }).click();
      await expect(page.getByText("Showing 1 of 5 records")).toBeVisible({ timeout: 10000 });
      
      const firstRunText = await page.getByRole("table").textContent();

      // Second run with same seed
      await page.getByLabel("Number of records").fill("5");
      await page.getByLabel("Seed").fill("repro-seed");
      await page.getByRole("button", { name: "Generate 5 Records" }).click();
      
      await expect(page.getByText("Replace 5 existing records?")).toBeVisible();
      await page.getByRole("button", { name: "Replace 5 Records" }).click();

      await expect(page.getByText("Showing 1 of 5 records")).toBeVisible({ timeout: 10000 });
      
      const secondRunText = await page.getByRole("table").textContent();
      
      expect(firstRunText).toEqual(secondRunText);
    });

    test("hybrid fallback notice", async ({ page }) => {
      // Mark field as semantic (LLM)
      await page.goto(`/projects/${projectId}`);
      await page.getByRole("button", { name: "Add Field" }).click();
      await page.getByLabel("Field name").fill("email");
      await page.getByLabel("Field type").selectOption("email");
      await page.getByRole("button", { name: "Save Field" }).click();

      await page.goto(`/projects/${projectId}/data`);

      await page.getByLabel("Number of records").fill("5");
      await page.getByLabel("Generation mode").selectOption("HYBRID_LLM");
      await page.getByRole("button", { name: "Generate 5 Records" }).click();

      // Since we don't have real LLM credentials in tests, it will fallback to Faker
      await expect(page.getByText(/Used fallback faker generation for \d+ records/i)).toBeVisible({ timeout: 10000 });
    });
  });
});
