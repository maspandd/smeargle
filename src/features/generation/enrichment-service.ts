import type { FieldDefinition, SchemaSnapshot } from "@/features/schema/schema-types";
import { validateRecordValue } from "@/features/schema/value-validator";
import type { GeneratedRecord } from "./record-generator";
import {
  LlmProviderError,
  type EnrichmentBatch,
  type EnrichmentResult,
  type LlmProvider,
} from "./llm-provider";

export type EnrichmentSummary = {
  requested: number;
  enriched: number;
  fallback: number;
  failedBatches: number;
};

type EnrichGeneratedRecordsInput = {
  schema: SchemaSnapshot;
  records: GeneratedRecord[];
  provider: LlmProvider;
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
};

type SemanticTarget = {
  recordOrdinal: number;
  fieldId: string;
  path: string[];
  required: boolean;
  neighboringValues: Record<string, unknown>;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;

export async function enrichGeneratedRecords(
  input: EnrichGeneratedRecordsInput,
): Promise<{ records: GeneratedRecord[]; summary: EnrichmentSummary }> {
  const batchSize = boundedBatchSize(input.batchSize ?? DEFAULT_BATCH_SIZE);
  const timeoutMs = positiveInteger(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeout");
  const maxRetries = boundedRetries(input.maxRetries ?? DEFAULT_MAX_RETRIES);
  const records = input.records.map((record) => ({
    id: record.id,
    value: structuredClone(record.value),
  }));
  const targets = collectSemanticTargets(input.schema, records);
  const summary: EnrichmentSummary = {
    requested: targets.length,
    enriched: 0,
    fallback: 0,
    failedBatches: 0,
  };

  for (let start = 0; start < targets.length; start += batchSize) {
    const batchTargets = targets.slice(start, start + batchSize);
    const request = createProviderRequest(batchTargets);
    const response = await requestWithRetries({
      provider: input.provider,
      request,
      timeoutMs,
      maxRetries,
    });

    if (!response) {
      summary.fallback += batchTargets.length;
      summary.failedBatches += 1;
      continue;
    }

    applyResponse({
      schema: input.schema,
      records,
      targets: batchTargets,
      response,
      summary,
    });
  }

  return { records, summary };
}

function collectSemanticTargets(
  schema: SchemaSnapshot,
  records: GeneratedRecord[],
): SemanticTarget[] {
  return records.flatMap((record, recordOrdinal) =>
    collectObjectTargets({
      fields: schema.fields,
      value: record.value,
      recordOrdinal,
      path: [],
    }),
  );
}

function collectObjectTargets(input: {
  fields: FieldDefinition[];
  value: Record<string, unknown>;
  recordOrdinal: number;
  path: string[];
}): SemanticTarget[] {
  const targets: SemanticTarget[] = [];

  for (const field of input.fields) {
    const fieldValue = input.value[field.name];
    const fieldPath = [...input.path, field.name];

    if (field.type === "email" && fieldValue !== null && fieldValue !== undefined) {
      targets.push({
        recordOrdinal: input.recordOrdinal,
        fieldId: field.id,
        path: fieldPath,
        required: field.required,
        neighboringValues: withoutKey(input.value, field.name),
      });
      continue;
    }

    if (
      field.type === "object" &&
      isPlainObject(fieldValue)
    ) {
      targets.push(
        ...collectObjectTargets({
          fields: field.fields,
          value: fieldValue,
          recordOrdinal: input.recordOrdinal,
          path: fieldPath,
        }),
      );
    }
  }

  return targets;
}

function createProviderRequest(targets: SemanticTarget[]): EnrichmentBatch {
  return {
    locale: "id-ID",
    items: targets.map((target) => ({
      recordOrdinal: target.recordOrdinal,
      fieldId: target.fieldId,
      semanticType: "email",
      constraints: { required: target.required },
      neighboringValues: target.neighboringValues,
    })),
  };
}

async function requestWithRetries(input: {
  provider: LlmProvider;
  request: EnrichmentBatch;
  timeoutMs: number;
  maxRetries: number;
}): Promise<EnrichmentResult | null> {
  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    try {
      return await requestWithTimeout(
        input.provider,
        input.request,
        input.timeoutMs,
      );
    } catch (error) {
      if (!isTransient(error) || attempt === input.maxRetries) {
        return null;
      }
    }
  }

  return null;
}

async function requestWithTimeout(
  provider: LlmProvider,
  request: EnrichmentBatch,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      provider.enrich(request, controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new LlmProviderError("Provider request timed out", {
              code: "TIMEOUT",
              transient: true,
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function applyResponse(input: {
  schema: SchemaSnapshot;
  records: GeneratedRecord[];
  targets: SemanticTarget[];
  response: EnrichmentResult;
  summary: EnrichmentSummary;
}) {
  const valuesByTarget = new Map(
    input.response.values.map((value) => [
      targetKey(value.recordOrdinal, value.fieldId),
      value.value,
    ]),
  );

  for (const target of input.targets) {
    const key = targetKey(target.recordOrdinal, target.fieldId);

    if (!valuesByTarget.has(key)) {
      input.summary.fallback += 1;
      continue;
    }

    const candidate = structuredClone(input.records[target.recordOrdinal]);
    setPath(candidate.value, target.path, valuesByTarget.get(key));
    const validation = validateRecordValue(input.schema, candidate.value);

    if (!validation.ok) {
      input.summary.fallback += 1;
      continue;
    }

    input.records[target.recordOrdinal] = candidate;
    input.summary.enriched += 1;
  }
}

function targetKey(recordOrdinal: number, fieldId: string) {
  return `${recordOrdinal}:${fieldId}`;
}

function setPath(
  value: Record<string, unknown>,
  path: string[],
  replacement: unknown,
) {
  let current = value;

  for (const segment of path.slice(0, -1)) {
    const child = current[segment];

    if (!isPlainObject(child)) {
      return;
    }

    current = child;
  }

  const leaf = path.at(-1);

  if (leaf) {
    current[leaf] = replacement;
  }
}

function withoutKey(
  value: Record<string, unknown>,
  excludedKey: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== excludedKey)
      .map(([key, child]) => [key, structuredClone(child)]),
  );
}

function isTransient(error: unknown) {
  return error instanceof LlmProviderError ? error.transient : true;
}

function boundedBatchSize(value: number) {
  const batchSize = positiveInteger(value, "batch size");

  return Math.min(batchSize, DEFAULT_BATCH_SIZE);
}

function boundedRetries(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Max retries must be a non-negative integer");
  }

  return Math.min(value, DEFAULT_MAX_RETRIES);
}

function positiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
