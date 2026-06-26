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

test.describe("Phase 4 Mock API CRUD", () => {
  const routeKey = "mock_api_test_key";

  test.beforeEach(async () => {
    fixture("reset");
    fixture("seed-mock-api", {
      routeKey,
      tokenRequired: false,
      records: [
        { name: "Item 1", price: 10 },
        { name: "Item 2", price: 20 },
      ],
    });
  });

  test("AC-04.01 and AC-04.02 GET returns collection and exact empty arrays", async ({ request }) => {
    const res = await request.get(`/api/mock/${routeKey}/api/items`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Item 1");
    expect(body.meta.count).toBe(2);

    // Filter to get empty array
    const emptyRes = await request.get(`/api/mock/${routeKey}/api/items?name=Unknown`);
    expect(emptyRes.status()).toBe(200);
    const emptyBody = await emptyRes.json();
    expect(emptyBody.data).toEqual([]);
    expect(emptyBody.meta.count).toBe(0);
  });

  test("AC-04.03 POST validates, creates an ID, returns 201, and appears in GET", async ({ request }) => {
    const postRes = await request.post(`/api/mock/${routeKey}/api/items`, {
      data: { name: "New Item", price: 30 },
    });
    expect(postRes.status()).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.id).toBeDefined();
    expect(postBody.name).toBe("New Item");

    const getRes = await request.get(`/api/mock/${routeKey}/api/items`);
    const getBody = await getRes.json();
    expect(getBody.meta.count).toBe(3);
  });

  test("AC-04.04 Unknown route key returns JSON 404", async ({ request }) => {
    const res = await request.get(`/api/mock/unknown_key/api/items`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  test("PUT replaces record, PATCH merges, DELETE removes", async ({ request }) => {
    // 1. Get the first record ID
    const getRes = await request.get(`/api/mock/${routeKey}/api/items`);
    const getBody = await getRes.json();
    const id = getBody.data[0].id;

    // 2. PUT
    const putRes = await request.put(`/api/mock/${routeKey}/api/items/${id}`, {
      data: { name: "Replaced Item", price: 99 },
    });
    expect(putRes.status()).toBe(200);
    expect((await putRes.json()).name).toBe("Replaced Item");

    // 3. PATCH
    const patchRes = await request.patch(`/api/mock/${routeKey}/api/items/${id}`, {
      data: { price: 199 },
    });
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.name).toBe("Replaced Item"); // Kept original name
    expect(patchBody.price).toBe(199); // Updated price

    // 4. DELETE
    const delRes = await request.delete(`/api/mock/${routeKey}/api/items/${id}`);
    expect(delRes.status()).toBe(204);

    // 5. Verify DELETE
    const getDeletedRes = await request.get(`/api/mock/${routeKey}/api/items/${id}`);
    expect(getDeletedRes.status()).toBe(404);
  });

  test("Validation errors (422) for incorrect types", async ({ request }) => {
    const postRes = await request.post(`/api/mock/${routeKey}/api/items`, {
      data: { name: "Invalid", price: "not-a-number" },
    });
    expect(postRes.status()).toBe(422);
    const postBody = await postRes.json();
    expect(postBody.error.code).toBe("VALIDATION_ERROR");
  });
});
