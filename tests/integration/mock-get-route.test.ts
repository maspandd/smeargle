import { describe, expect, it, beforeEach } from "vitest";
import { GET } from "@/app/api/mock/[routeKey]/[...segments]/route";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";
import { NextRequest } from "next/server";

describe("Mock API GET Routes Integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("handles GET /api/mock/[routeKey]/[resource] for collection read", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_collection_route" },
    });
    const schema = await prisma.schemaVersion.create({
      data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
    });

    for (let i = 0; i < 5; i++) {
      await prisma.mockRecord.create({
        data: {
          projectId: project.id,
          schemaVersionId: schema.id,
          ordinal: i,
          source: "GENERATED",
          value: { id: `id-${i}`, name: `Item ${i}` },
        },
      });
    }

    const req = new NextRequest("http://localhost:3000/api/mock/key_collection_route/products?page=1&pageSize=2");
    const response = await GET(req, { params: Promise.resolve({ routeKey: "key_collection_route", segments: ["products"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const json = await response.json();
    expect(json.data).toHaveLength(2);
    expect(json.meta).toMatchObject({
      count: 5,
      endpoint: "/api/products",
      projectId: project.id,
    });
  });

  it("handles GET /api/mock/[routeKey]/[resource]/[id] for single record read", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_record_route" },
    });
    const schema = await prisma.schemaVersion.create({
      data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
    });

    await prisma.mockRecord.create({
      data: {
        projectId: project.id,
        schemaVersionId: schema.id,
        ordinal: 1,
        source: "GENERATED",
        value: { id: `record-999`, name: `Target Item` },
      },
    });

    const req = new NextRequest("http://localhost:3000/api/mock/key_record_route/products/record-999");
    const response = await GET(req, { params: Promise.resolve({ routeKey: "key_record_route", segments: ["products", "record-999"] }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe("record-999");
    expect(json.data.name).toBe("Target Item");
  });
});
