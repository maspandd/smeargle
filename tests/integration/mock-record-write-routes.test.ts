import { describe, expect, it, beforeEach } from "vitest";
import { PUT, PATCH, DELETE } from "@/app/api/mock/[routeKey]/[...segments]/route";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";
import { NextRequest } from "next/server";

describe("Mock API Record Write Routes Integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupProject() {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_write_route", dataStatus: "COMPATIBLE", tokenRequired: false },
    });
    const schema = await prisma.schemaVersion.create({
      data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });
    
    await prisma.mockRecord.create({
      data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 1, source: "GENERATED", value: { id: "record-1", extra: "old" } }
    });
    return project;
  }

  it("handles PUT to replace a record", async () => {
    await setupProject();
    const req = new NextRequest("http://localhost:3000/api/mock/key_write_route/products/record-1", {
      method: "PUT",
      body: JSON.stringify({ id: "record-1", name: "Replaced Item" }),
    });
    const response = await PUT(req, { params: Promise.resolve({ routeKey: "key_write_route", segments: ["products", "record-1"] }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.name).toBe("Replaced Item");
    expect(json.data.extra).toBeUndefined(); // Should replace, not merge
  });

  it("handles PATCH to merge a partial record", async () => {
    await setupProject();
    const req = new NextRequest("http://localhost:3000/api/mock/key_write_route/products/record-1", {
      method: "PATCH",
      body: JSON.stringify({ patched: true }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ routeKey: "key_write_route", segments: ["products", "record-1"] }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.patched).toBe(true);
    expect(json.data.extra).toBe("old"); // Should merge
  });

  it("handles DELETE to remove a record", async () => {
    await setupProject();
    const req = new NextRequest("http://localhost:3000/api/mock/key_write_route/products/record-1", {
      method: "DELETE",
    });
    const response = await DELETE(req, { params: Promise.resolve({ routeKey: "key_write_route", segments: ["products", "record-1"] }) });

    expect(response.status).toBe(204);
  });
});
