import { describe, expect, it, beforeEach } from "vitest";
import { createRecord, updateRecord, patchRecord, deleteRecord } from "./write-service";
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

describe("Mock API Write Service - PUT, PATCH, DELETE", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupProject() {
    const project = await prisma.project.create({
      data: { name: "Test Write", baseEndpoint: "/api/items", routeKey: "key_write_upd", dataStatus: "COMPATIBLE" },
    });
    const schema = await prisma.schemaVersion.create({
      data: {
        projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
        snapshot: { fields: [{ id: "f1", name: "name", type: "string", required: true }, { id: "f2", name: "extra", type: "string", required: false }] }
      },
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentSchemaVersionId: schema.id } });
    const context = await resolveRuntimeContext("key_write_upd", ["items", "rec-1"]);
    await prisma.mockRecord.create({
      data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 1, source: "GENERATED", value: { id: "rec-1", name: "Old", extra: "OldExtra" } }
    });
    return { project, context };
  }

  it("updateRecord (PUT) replaces the full record and preserves URL ID", async () => {
    const { context, project } = await setupProject();
    
    // extra is omitted
    const body = { id: "rec-other", name: "Replaced" };
    const result = await updateRecord(context, "rec-1", body);
    
    expect(result.id).toBe("rec-1"); // ID should be forced from URL
    expect(result.name).toBe("Replaced");
    expect(result.extra).toBeUndefined(); // Omitted in PUT

    const audits = await prisma.auditEvent.findMany({ where: { projectId: project.id, action: "DATA_GENERATED" } });
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toMatchObject({ recordId: "rec-1", operation: "UPDATE" });
  });

  it("updateRecord (PUT) rejects missing required fields", async () => {
    const { context } = await setupProject();
    const body = { extra: "only extra" }; // missing required "name"
    
    try {
      await updateRecord(context, "rec-1", body);
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(MockRuntimeError);
      expect((e as MockRuntimeError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("patchRecord (PATCH) merges a partial object", async () => {
    const { context, project } = await setupProject();
    
    const body = { name: "Patched" }; // partial, "extra" not provided
    const result = await patchRecord(context, "rec-1", body);
    
    expect(result.id).toBe("rec-1");
    expect(result.name).toBe("Patched");
    expect(result.extra).toBe("OldExtra"); // Merged
  });

  it("deleteRecord (DELETE) removes a record", async () => {
    const { context, project } = await setupProject();
    
    await deleteRecord(context, "rec-1");
    
    const count = await prisma.mockRecord.count({ where: { projectId: project.id } });
    expect(count).toBe(0);
  });
});
