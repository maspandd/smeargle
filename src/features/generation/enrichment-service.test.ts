import { describe, expect, it, vi } from "vitest";
import type { GeneratedRecord } from "./record-generator";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import {
  enrichGeneratedRecords,
  type EnrichmentSummary,
} from "./enrichment-service";
import { FakeLlmProvider } from "./fake-llm-provider";
import { LlmProviderError } from "./llm-provider";

const schema: SchemaSnapshot = {
  fields: [
    {
      id: "fld_product_name",
      name: "product_name",
      type: "string",
      required: true,
      minLength: 3,
      maxLength: 40,
    },
    {
      id: "fld_customer_email",
      name: "customer_email",
      type: "email",
      required: true,
    },
  ],
};

function record(ordinal: number): GeneratedRecord {
  return {
    id: `rec_${String(ordinal).padStart(24, "a")}`,
    value: {
      product_name: `Produk ${ordinal}`,
      customer_email: `faker-${ordinal}@example.test`,
    },
  };
}

function fallbackSummary(
  overrides: Partial<EnrichmentSummary> = {},
): EnrichmentSummary {
  return {
    requested: 1,
    enriched: 0,
    fallback: 1,
    failedBatches: 0,
    ...overrides,
  };
}

describe("enrichment service", () => {
  it("sends a minimal provider request and applies a valid enrichment", async () => {
    const provider = new FakeLlmProvider(async (request) => ({
      values: request.items.map((item) => ({
        recordOrdinal: item.recordOrdinal,
        fieldId: item.fieldId,
        value: "pelanggan@contoh.id",
      })),
    }));

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0)],
      provider,
    });

    expect(provider.requests).toEqual([
      {
        locale: "id-ID",
        items: [
          {
            recordOrdinal: 0,
            fieldId: "fld_customer_email",
            semanticType: "email",
            constraints: { required: true },
            neighboringValues: { product_name: "Produk 0" },
          },
        ],
      },
    ]);
    expect(JSON.stringify(provider.requests[0])).not.toMatch(
      /secret|password|token|userId|audit|projectId/i,
    );
    expect(result.records[0].value.customer_email).toBe("pelanggan@contoh.id");
    expect(result.summary).toEqual({
      requested: 1,
      enriched: 1,
      fallback: 0,
      failedBatches: 0,
    });
  });

  it("uses bounded provider batches without making network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new FakeLlmProvider(async (request) => ({
      values: request.items.map((item) => ({
        recordOrdinal: item.recordOrdinal,
        fieldId: item.fieldId,
        value: `pelanggan-${item.recordOrdinal}@contoh.id`,
      })),
    }));

    const result = await enrichGeneratedRecords({
      schema,
      records: Array.from({ length: 26 }, (_, ordinal) => record(ordinal)),
      provider,
      batchSize: 25,
    });

    expect(provider.requests.map((request) => request.items.length)).toEqual([
      25, 1,
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.summary).toEqual({
      requested: 26,
      enriched: 26,
      fallback: 0,
      failedBatches: 0,
    });
    fetchSpy.mockRestore();
  });

  it("falls back after a provider timeout", async () => {
    const provider = new FakeLlmProvider(
      () => new Promise(() => undefined),
    );

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0)],
      provider,
      timeoutMs: 5,
      maxRetries: 0,
    });

    expect(result.records[0].value.customer_email).toBe(
      "faker-0@example.test",
    );
    expect(result.summary).toEqual(
      fallbackSummary({ failedBatches: 1 }),
    );
  });

  it("retries transient thrown errors at most twice before falling back", async () => {
    const provider = new FakeLlmProvider(async () => {
      throw new Error("Temporary provider outage");
    });

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0)],
      provider,
      timeoutMs: 50,
    });

    expect(provider.requests).toHaveLength(3);
    expect(result.records[0].value.customer_email).toBe(
      "faker-0@example.test",
    );
    expect(result.summary).toEqual(
      fallbackSummary({ failedBatches: 1 }),
    );
  });

  it("keeps faker values for a partial provider response", async () => {
    const provider = new FakeLlmProvider(async () => ({
      values: [
        {
          recordOrdinal: 0,
          fieldId: "fld_customer_email",
          value: "valid@contoh.id",
        },
      ],
    }));

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0), record(1)],
      provider,
    });

    expect(result.records[0].value.customer_email).toBe("valid@contoh.id");
    expect(result.records[1].value.customer_email).toBe(
      "faker-1@example.test",
    );
    expect(result.summary).toEqual({
      requested: 2,
      enriched: 1,
      fallback: 1,
      failedBatches: 0,
    });
  });

  it("keeps the faker value when the provider returns an invalid value", async () => {
    const provider = new FakeLlmProvider(async () => ({
      values: [
        {
          recordOrdinal: 0,
          fieldId: "fld_customer_email",
          value: "not-an-email",
        },
      ],
    }));

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0)],
      provider,
    });

    expect(result.records[0].value.customer_email).toBe(
      "faker-0@example.test",
    );
    expect(result.summary).toEqual(fallbackSummary());
  });

  it("does not retry a quota error and keeps the faker value", async () => {
    const provider = new FakeLlmProvider(async () => {
      throw new LlmProviderError("Provider quota exceeded", {
        code: "QUOTA_EXCEEDED",
        transient: false,
      });
    });

    const result = await enrichGeneratedRecords({
      schema,
      records: [record(0)],
      provider,
    });

    expect(provider.requests).toHaveLength(1);
    expect(result.records[0].value.customer_email).toBe(
      "faker-0@example.test",
    );
    expect(result.summary).toEqual(
      fallbackSummary({ failedBatches: 1 }),
    );
  });
});
