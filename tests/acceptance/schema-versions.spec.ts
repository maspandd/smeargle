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

async function addField(
  page: import("@playwright/test").Page,
  input: { name: string; type?: "number" },
) {
  await page.getByRole("button", { name: "Add Field" }).click();
  await page.getByLabel("Field name").fill(input.name);

  if (input.type === "number") {
    await page.getByLabel("Field type").selectOption("number");
  }

  await page.getByRole("button", { name: "Save Field" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(input.name, { exact: true })).toBeVisible();
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
    await addField(page, { name: "product_name" });
    await addField(page, { name: "price", type: "number" });

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

  test("downloads a schema snapshot and restores an earlier version as a new current version", async ({
    page,
  }) => {
    await addField(page, { name: "product_name" });
    await addField(page, { name: "price", type: "number" });

    const projectUrl = page.url();
    await page.goto(`${projectUrl}/versions`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download v1.2 JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("products-api-schema-v1.2.json");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restore v1.1" }).click();

    const history = page.getByRole("list", { name: "Schema version history" });
    await expect(history.getByRole("heading", { name: "v1.3" })).toBeVisible();
    await expect(history.getByRole("heading", { name: "v1.2" })).toBeVisible();
    await expect(page.getByText("Restored schema from v1.1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparing v1.3 to v1.2" })).toBeVisible();
  });

  test("cancels rollback without creating a new version", async ({ page }) => {
    await addField(page, { name: "product_name" });
    await addField(page, { name: "price", type: "number" });

    const projectUrl = page.url();
    await page.goto(`${projectUrl}/versions`);

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Restore v1.1" }).click();

    const history = page.getByRole("list", { name: "Schema version history" });
    await expect(history.getByRole("heading", { name: "v1.2" })).toBeVisible();
    await expect(history.getByRole("heading", { name: "v1.3" })).toHaveCount(0);
  });
});
