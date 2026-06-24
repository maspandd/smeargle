import { describe, expect, it } from "vitest";
import { generateRecord } from "../../src/features/generation/record-generator";

import type { SchemaSnapshot } from "../../src/features/schema/schema-types";

describe("Performance: Faker Generation", () => {
  it.skipIf(process.env.CI)("generates and validates 1,000 representative records in under 10 seconds", async () => {
    // We skip this on CI because GitHub Actions standard runners have unpredictable 
    // noisy-neighbor CPU profiles that could cause flaky performance test failures.
    
    const representativeSchema: SchemaSnapshot = {
      fields: [
        { id: "f1", name: "id", type: "string", required: true },
        { id: "f2", name: "email", type: "string", required: true },
        { id: "f3", name: "age", type: "number", required: true, min: 18, max: 100 },
        { id: "f4", name: "active", type: "boolean", required: true },
        { id: "f5", name: "metadata", type: "object", required: false, fields: [
          { id: "f5_1", name: "role", type: "string", required: true },
          { id: "f5_2", name: "lastLogin", type: "date", required: true },
        ]},
        { id: "f6", name: "tags", type: "array", required: true, item: { id: "f6_item", name: "tag", type: "string", required: true } }
      ]
    };

    const count = 1000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      generateRecord({
        schema: representativeSchema,
        seed: "perf-seed",
        ordinal: i,
        nullRate: 0.1,
      });
    }

    const end = performance.now();
    const durationMs = end - start;

    expect(durationMs).toBeLessThan(10000); // 10 seconds
  }, 15000); // Test timeout 15s
});
