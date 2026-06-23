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

test.describe("Phase 1 authentication", () => {
  test.beforeEach(() => fixture("reset"));

  test("rejects invalid credentials with the generic error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("missing@example.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(
      page.getByText("Invalid email or password", { exact: true }),
    ).toBeVisible();
  });

  test("logs in and opens the dashboard", async ({ page }) => {
    fixture("seed-user", { email: "owner@example.test", options: {} });
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@example.test");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });
});
