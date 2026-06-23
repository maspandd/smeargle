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
    type?: "date" | "number";
    minLength?: string;
    maxLength?: string;
    min?: string;
    max?: string;
    precision?: string;
    minDate?: string;
    maxDate?: string;
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
  if (input.minDate) {
    await page.getByLabel("Earliest date").fill(input.minDate);
  }
  if (input.maxDate) {
    await page.getByLabel("Latest date").fill(input.maxDate);
  }

  await page.getByRole("button", { name: "Save Field" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(input.name, { exact: true })).toBeVisible();
}

test.describe("Phase 2 schema constraints", () => {
  test.beforeEach(async ({ page }) => {
    await createProject(page);
  });

  test("persists and displays String, Number, and Date constraints", async ({ page }) => {
    await addField(page, {
      name: "product_name",
      minLength: "3",
      maxLength: "80",
    });
    await expect(page.getByText("Length 3-80", { exact: true })).toBeVisible();

    await addField(page, {
      name: "price",
      type: "number",
      min: "0",
      max: "9999.99",
      precision: "2",
    });
    await expect(
      page.getByText("Range 0 to 9999.99 - Precision 2", { exact: true }),
    ).toBeVisible();

    await addField(page, {
      name: "launch_date",
      type: "date",
      minDate: "2026-01-01",
      maxDate: "2026-12-31",
    });
    await expect(
      page.getByText("From 2026-01-01 to 2026-12-31", { exact: true }),
    ).toBeVisible();
  });

  test("rejects a Number maximum below the minimum and keeps the dialog open", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add Field" }).click();
    await page.getByLabel("Field name").fill("price");
    await page.getByLabel("Field type").selectOption("number");
    await page.getByLabel("Minimum value").fill("100");
    await page.getByLabel("Maximum value").fill("10");
    await page.getByRole("button", { name: "Save Field" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("price minimum cannot exceed maximum")).toBeVisible();
    await expect(page.getByText("No fields yet.", { exact: true })).toBeVisible();
  });
});
