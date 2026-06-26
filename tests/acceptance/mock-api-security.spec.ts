import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const runner = path.join(__dirname, "fixture-runner.cjs");
function fixture(action: string, input = {}) {
  const output = execFileSync(process.execPath, [runner, action, JSON.stringify(input)], {
    encoding: "utf8",
  });
  return output ? JSON.parse(output) : undefined;
}

test.describe("Phase 4 Mock API Security", () => {
  const routeKey = "mock_api_secure_key";
  const validTokenPlaintext = "tok_valid";
  // Simulated hash for testing. We'll use actual hash function in real tests or mock it in fixture.
  // Wait, in fixture-runner we need to hash the token if it's stored. The current fixture-runner just uses the exact tokenHash provided.
  // The token auth service hashes the incoming token. 
  // Let's rely on standard crypto to hash it here or let the runner do it. 
  // Actually, I can just use a predefined hash for a predefined plaintext if needed.
  // For simplicity, let's just let the test create the token via the API or use a known token/hash pair.
  // In `src/features/mock-runtime/token-auth.ts`, it uses SHA-256 base64url.

  let validHash: string;

  test.beforeAll(async () => {
    const crypto = await import("node:crypto");
    validHash = crypto.createHash("sha256").update(validTokenPlaintext).digest("base64url");
  });

  test.beforeEach(async () => {
    fixture("reset");
    fixture("seed-mock-api", {
      routeKey,
      tokenRequired: true,
      corsOrigins: ["https://allowed.com"],
      rateLimit: 10,
      tokenHash: validHash,
      records: [{ name: "Secret", price: 100 }],
    });
  });

  test("Requires valid token and returns 401 for missing/invalid", async ({ request }) => {
    // Missing
    const missingRes = await request.get(`/api/mock/${routeKey}/api/items`);
    expect(missingRes.status()).toBe(401);

    // Invalid
    const invalidRes = await request.get(`/api/mock/${routeKey}/api/items`, {
      headers: { Authorization: `Bearer wrong_token` },
    });
    expect(invalidRes.status()).toBe(401);

    // Valid
    const validRes = await request.get(`/api/mock/${routeKey}/api/items`, {
      headers: { Authorization: `Bearer ${validTokenPlaintext}` },
    });
    expect(validRes.status()).toBe(200);
  });

  test("CORS blocks unlisted origins and allows configured ones", async ({ request }) => {
    // Unlisted origin
    const unlistedRes = await request.get(`/api/mock/${routeKey}/api/items`, {
      headers: { 
        Authorization: `Bearer ${validTokenPlaintext}`,
        Origin: "https://evil.com" 
      },
    });
    expect(unlistedRes.status()).toBe(403);

    // Allowed origin
    const allowedRes = await request.get(`/api/mock/${routeKey}/api/items`, {
      headers: { 
        Authorization: `Bearer ${validTokenPlaintext}`,
        Origin: "https://allowed.com" 
      },
    });
    expect(allowedRes.status()).toBe(200);
    expect(allowedRes.headers()["access-control-allow-origin"]).toBe("https://allowed.com");
  });
});
