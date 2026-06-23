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

async function createProject(page: import("@playwright/test").Page) {
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
}

async function addField(
  page: import("@playwright/test").Page,
  input: {
    name: string;
    type?: "email" | "number";
    minLength?: string;
    maxLength?: string;
    min?: string;
    max?: string;
    precision?: string;
  },
) {
  await page.getByRole("button", { name: "Add Field" }).click();
  await page.getByLabel("Field name").fill(input.name);

  if (input.type) {
    await page.getByLabel("Field type").selectOption(input.type);
  }
  if (input.minLength) {
    await page.getByLabel("Minimum length").fill(input.minLength);
  }
  if (input.maxLength) {
    await page.getByLabel("Maximum length").fill(input.maxLength);
  }
  if (input.min) {
    await page.getByLabel("Minimum value").fill(input.min);
  }
  if (input.max) {
    await page.getByLabel("Maximum value").fill(input.max);
  }
  if (input.precision) {
    await page.getByLabel("Decimal precision").fill(input.precision);
  }

  await page.getByRole("button", { name: "Save Field" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(input.name, { exact: true })).toBeVisible();
}

test.describe("Phase 2 schema fields", () => {
  test.beforeEach(async ({ page }) => {
    await createProject(page);
  });

  test("adds constrained scalar fields and the Email semantic badge", async ({ page }) => {
    await addField(page, {
      name: "product_name",
      minLength: "3",
      maxLength: "80",
    });
    await expect(page.getByText("product_name", { exact: true })).toBeVisible();
    await expect(page.getByText("Length 3-80", { exact: true })).toBeVisible();
    await expect(page.getByText("v1.1", { exact: true })).toHaveCount(2);

    await addField(page, {
      name: "price",
      type: "number",
      min: "0",
      max: "9999.99",
      precision: "2",
    });
    await expect(page.getByText("price", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Range 0 to 9999.99 - Precision 2", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("v1.2", { exact: true })).toHaveCount(2);

    await addField(page, { name: "customer_email", type: "email" });
    await expect(page.getByText("customer_email", { exact: true })).toBeVisible();
    await expect(page.getByText("LLM-Powered", { exact: true })).toBeVisible();
    await expect(page.getByText("v1.3", { exact: true })).toHaveCount(2);
  });

  test("rejects a duplicate sibling field name without closing the dialog", async ({ page }) => {
    await addField(page, { name: "price", type: "number", min: "0", max: "100" });
    await expect(page.getByText("price", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("price");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Duplicate field name at price")).toBeVisible();
    await expect(page.getByText("v1.1", { exact: true })).toHaveCount(2);
  });
});
