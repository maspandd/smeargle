import { describe, expect, it, beforeEach } from "vitest";
import { resolveRuntimeContext } from "./runtime-context";
import { MockRuntimeError, toJsonErrorResponse } from "./runtime-error";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../../../tests/helpers/database";

describe("Runtime Context Resolution", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("resolves context for a matching route key and resource", async () => {
    // Create project
    const project = await prisma.project.create({
      data: {
        name: "Test",
        baseEndpoint: "/api/products",
        routeKey: "products_test_key",
      },
    });

    const context = await resolveRuntimeContext("products_test_key", ["products"]);
    
    expect(context.project.id).toBe(project.id);
    expect(context.resource).toBe("products");
    expect(context.requestId).toBeDefined();
    expect(context.schemaSnapshot).toBeUndefined(); // no schema yet
  });

  it("rejects unknown route key as PROJECT_NOT_FOUND", async () => {
    await expect(
      resolveRuntimeContext("unknown_key", ["products"])
    ).rejects.toThrowError(
      new MockRuntimeError("PROJECT_NOT_FOUND", "Project not found")
    );
  });

  it("rejects wrong resource as RESOURCE_NOT_FOUND", async () => {
    await prisma.project.create({
      data: {
        name: "Test",
        baseEndpoint: "/api/products",
        routeKey: "products_test_key",
      },
    });

    await expect(
      resolveRuntimeContext("products_test_key", ["users"])
    ).rejects.toThrowError(
      new MockRuntimeError("RESOURCE_NOT_FOUND", "Resource not found")
    );
  });

  it("rejects extra segments as RECORD_NOT_FOUND", async () => {
    await prisma.project.create({
      data: {
        name: "Test",
        baseEndpoint: "/api/products",
        routeKey: "products_test_key",
      },
    });

    await expect(
      resolveRuntimeContext("products_test_key", ["products", "123", "extra"])
    ).rejects.toThrowError(
      new MockRuntimeError("RECORD_NOT_FOUND", "Record not found")
    );
  });
});

describe("JSON Error Envelope", () => {
  it("wraps MockRuntimeError in a JSON response with a generated request ID", async () => {
    const error = new MockRuntimeError("PROJECT_NOT_FOUND", "Project not found");
    const reqId = "req-123";
    
    const response = toJsonErrorResponse(error, reqId);
    
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(body.error.message).toBe("Project not found");
    expect(body.requestId).toBe(reqId);
  });

  it("formats generic errors securely", async () => {
    const error = new Error("Database connection failed (secret)");
    const reqId = "req-123";

    const response = toJsonErrorResponse(error, reqId);
    
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.status).toBe(500);
    
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred");
    expect(body.requestId).toBe(reqId);
  });
});
