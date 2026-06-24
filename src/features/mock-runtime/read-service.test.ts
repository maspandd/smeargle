import { describe, expect, it, beforeEach } from "vitest";
import { getRecords, getRecordById } from "./read-service";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";
import { resolveRuntimeContext } from "./runtime-context";
import { MockRuntimeError } from "./runtime-error";

describe("Mock API Read Service", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("getRecords", () => {
    it("returns empty array and count zero for an empty project", async () => {
      const project = await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_empty" },
      });
      const context = await resolveRuntimeContext("key_empty", ["products"]);

      const result = await getRecords(context, new URLSearchParams());
      expect(result.data).toEqual([]);
      expect(result.meta.count).toBe(0);
      expect(result.meta.endpoint).toBe("/api/products");
      expect(result.meta.projectId).toBe(project.id);
    });

    it("returns paginated records and respects page/pageSize limits", async () => {
      const project = await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_pages" },
      });
      const schema = await prisma.schemaVersion.create({
        data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
      });

      for (let i = 0; i < 15; i++) {
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

      const context = await resolveRuntimeContext("key_pages", ["products"]);
      
      const search = new URLSearchParams();
      search.set("page", "2");
      search.set("pageSize", "10");

      const result = await getRecords(context, search);
      expect(result.data).toHaveLength(5);
      expect(result.meta.count).toBe(15);
    });

    it("supports stable sort by an allowed scalar field and exact-match filters", async () => {
      const project = await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_query" },
      });
      const schema = await prisma.schemaVersion.create({
        data: {
          projectId: project.id,
          major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
          snapshot: {
            fields: [
              { name: "category", type: "STRING" },
              { name: "price", type: "NUMBER" },
              { name: "nested", type: "OBJECT", fields: [{ name: "inner", type: "STRING" }] }
            ]
          }
        },
      });

      await prisma.mockRecord.create({ data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 1, source: "GENERATED", value: { id: "1", category: "A", price: 100 } } });
      await prisma.mockRecord.create({ data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 2, source: "GENERATED", value: { id: "2", category: "B", price: 50 } } });
      await prisma.mockRecord.create({ data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 3, source: "GENERATED", value: { id: "3", category: "A", price: 200 } } });

      const context = await resolveRuntimeContext("key_query", ["products"]);
      
      // Filter by category=A and sort by price descending
      const search = new URLSearchParams();
      search.set("category", "A");
      search.set("sortBy", "price");
      search.set("sortOrder", "desc");

      const result = await getRecords(context, search);
      expect(result.data).toHaveLength(2);
      expect(result.meta.count).toBe(2);
      expect((result.data[0] as { price: number }).price).toBe(200);
      expect((result.data[1] as { price: number }).price).toBe(100);
    });

    it("rejects nested or unknown sort fields", async () => {
      const project = await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_reject" },
      });
      await prisma.schemaVersion.create({
        data: {
          projectId: project.id,
          major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init",
          snapshot: {
            fields: [{ name: "category", type: "STRING" }]
          }
        },
      });

      const context = await resolveRuntimeContext("key_reject", ["products"]);
      
      const search1 = new URLSearchParams(); search1.set("sortBy", "unknown_field");
      await expect(getRecords(context, search1)).rejects.toThrowError(
        new MockRuntimeError("VALIDATION_ERROR", "Cannot sort by unknown field: unknown_field")
      );

      const search2 = new URLSearchParams(); search2.set("sortBy", "nested.inner");
      await expect(getRecords(context, search2)).rejects.toThrowError(
        new MockRuntimeError("VALIDATION_ERROR", "Cannot sort by unknown field: nested.inner")
      );
    });
  });

  describe("getRecordById", () => {
    it("returns one object for a known ID", async () => {
      const project = await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_single" },
      });
      const schema = await prisma.schemaVersion.create({
        data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
      });

      await prisma.mockRecord.create({
        data: { projectId: project.id, schemaVersionId: schema.id, ordinal: 1, source: "GENERATED", value: { id: "record-123", name: "Single Item" } },
      });

      const context = await resolveRuntimeContext("key_single", ["products"]);
      context.recordId = "record-123";

      const record = await getRecordById(context);
      expect((record as { id: string }).id).toBe("record-123");
      expect((record as { name: string }).name).toBe("Single Item");
    });

    it("throws RECORD_NOT_FOUND for an unknown ID without leaking DB details", async () => {
      await prisma.project.create({
        data: { name: "Test", baseEndpoint: "/api/products", routeKey: "key_single_miss" },
      });
      const context = await resolveRuntimeContext("key_single_miss", ["products"]);
      context.recordId = "unknown-record";

      await expect(getRecordById(context)).rejects.toThrowError(
        new MockRuntimeError("RECORD_NOT_FOUND", "Record not found")
      );
    });
  });
});
