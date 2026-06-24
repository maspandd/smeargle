import { describe, expect, it, beforeEach } from "vitest";
import { createRecord } from "./write-service";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { resolveRuntimeContext } from "./runtime-context";
import { MockRuntimeError } from "./runtime-error";

describe("Mock API Write Service - POST", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a record with generated ID and validates schema", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post", dataStatus: "COMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: {
        projectId: project.id,
        major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
        snapshot: {
          fields: [{ id: "f1", name: "name", type: "string", required: false }]
        }
      },
    });

    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });
    
    const context = await resolveRuntimeContext("key_post", ["products"]);
    
    const body = { name: "New Product" };
    const result = await createRecord(context, body);
    
    const record = result as { id: string; name: string };
    expect(record.id).toBeDefined();
    expect(record.name).toBe("New Product");

    const count = await prisma.mockRecord.count({ where: { projectId: project.id } });
    expect(count).toBe(1);
    
    const audits = await prisma.auditEvent.findMany({ where: { projectId: project.id, action: "DATA_GENERATED" } });
    expect(audits).toHaveLength(1);
  });

  it("throws 422 for wrong field type with path and message", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post_err", dataStatus: "COMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: {
        projectId: project.id,
        major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
        snapshot: {
          fields: [{ id: "f2", name: "price", type: "number", required: true }]
        }
      },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });

    const context = await resolveRuntimeContext("key_post_err", ["products"]);
    
    const body = { price: "not a number" };
    try {
      await createRecord(context, body);
      expect.fail("Should throw MockRuntimeError");
    } catch (e) {
      expect(e).toBeInstanceOf(MockRuntimeError);
      expect((e as MockRuntimeError).code).toBe("VALIDATION_ERROR");
      expect((e as MockRuntimeError).details).toBeDefined(); // should contain path and message
    }
  });

  it("throws 409 for duplicate explicit ID", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post_dup", dataStatus: "COMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: {
        projectId: project.id,
        major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
        snapshot: { fields: [] }
      },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });
    
    await prisma.mockRecord.create({
      data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 1, source: "GENERATED", value: { id: "dup-123" } }
    });

    const context = await resolveRuntimeContext("key_post_dup", ["products"]);
    
    const body = { id: "dup-123" };
    await expect(createRecord(context, body)).rejects.toThrowError(
      new MockRuntimeError("CONFLICT", "Record with this ID already exists")
    );
  });

  it("blocks writes with 409 when project data is incompatible", async () => {
    const project = await prisma.project.create({
      data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_post_incompat", dataStatus: "INCOMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: {
        projectId: project.id,
        major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
        snapshot: { fields: [] }
      },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });

    const context = await resolveRuntimeContext("key_post_incompat", ["products"]);
    
    const body = {};
    await expect(createRecord(context, body)).rejects.toThrowError(
      new MockRuntimeError("CONFLICT", "Project data is incompatible with current schema")
    );
  });
});
