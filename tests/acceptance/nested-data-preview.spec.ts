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

test.describe("Phase 3 nested data preview", () => {
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

    // Go to project to add fields
    await page.goto(`/projects/${projectId}`);

    // Add Object field
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("metadata");
    await page.getByLabel("Field type").selectOption("object");
    await page.getByRole("button", { name: "Save Field" }).click();

    // Add Array field
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("tags");
    await page.getByLabel("Field type").selectOption("array");
    await page.getByLabel("Item type").selectOption("string");
    await page.getByLabel("Item minimum length").fill("5");
    await page.getByLabel("Item maximum length").fill("10");
    await page.getByRole("button", { name: "Save Field" }).click();

    // Add nested Object field
    await page.getByRole("button", { name: "Expand metadata" }).click();
    const group = page.getByRole("group", { name: "metadata fields" });
    await group.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("role");
    await page.getByRole("button", { name: "Save Field" }).click();

    await page.goto(`/projects/${projectId}/data`);
  });

  test("generates and previews nested object data and arrays (AC-08.02, AC-08.05)", async ({ page }) => {
    await page.getByLabel("Number of records").fill("5");
    await page.getByLabel("Null percentage").fill("0");
    await page.getByRole("button", { name: "Generate 5 Records" }).click();

    await expect(page.getByText("Showing 1 of 5 records")).toBeVisible({ timeout: 10000 });

    // Check for nested disclosure controls
    const metadataDisclosure = page.getByText("{ ... }").first();
    await expect(metadataDisclosure).toBeVisible();

    const tagsDisclosure = page.getByText("[ ... ]").first();
    await expect(tagsDisclosure).toBeVisible();

    // Verify formatted JSON contents
    await metadataDisclosure.click();
    await expect(page.getByText(/"role":/).first()).toBeVisible();

    await tagsDisclosure.click();
    // Verify arrays contain string items with bounds
    const arrayContent = await tagsDisclosure.locator("xpath=../..").locator("pre").textContent();
    const arrayItems = JSON.parse(arrayContent || "[]");
    expect(Array.isArray(arrayItems)).toBe(true);
    for (const item of arrayItems) {
      expect(typeof item).toBe("string");
      expect(item.length).toBeGreaterThanOrEqual(5);
      expect(item.length).toBeLessThanOrEqual(10);
    }
  });
});
