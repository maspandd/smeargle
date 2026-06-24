import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "@/app/api/mock/[routeKey]/[...segments]/route";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";
import { NextRequest } from "next/server";

describe("Mock API POST Routes Integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("handles POST /api/mock/[routeKey]/[resource] to create a record", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post_route", dataStatus: "COMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });

    const req = new NextRequest("http://localhost:3000/api/mock/key_post_route/products", {
      method: "POST",
      body: JSON.stringify({ name: "Created Item" }),
    });
    const response = await POST(req, { params: Promise.resolve({ routeKey: "key_post_route", segments: ["products"] }) });

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const json = await response.json();
    expect(json.data.id).toBeDefined();
    expect(json.data.name).toBe("Created Item");
  });

  it("returns 400 for malformed JSON", async () => {
    await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post_malformed", dataStatus: "COMPATIBLE" },
    });

    const req = new NextRequest("http://localhost:3000/api/mock/key_post_malformed/products", {
      method: "POST",
      body: "{ malformed json",
    });
    const response = await POST(req, { params: Promise.resolve({ routeKey: "key_post_malformed", segments: ["products"] }) });

    expect(response.status).toBe(400);
  });
});
