# Phase 3 Data Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate reproducible Indonesian mock records from recursive schemas, optionally enrich semantic fields with an LLM, and atomically preview or replace datasets.

**Architecture:** A pure seeded generator produces every valid base value. Durable database jobs run generation outside requests, stage results, optionally enrich semantic fields through a provider interface, and swap the project dataset only after success.

**Tech Stack:** `@faker-js/faker` Indonesian locale, deterministic PRNG, PostgreSQL/Prisma, database-backed job adapter, provider-neutral LLM interface, Vitest property tests, Playwright

---

### Task 1: Persist records and generation jobs

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_generation/migration.sql`
- Create: `src/features/generation/job-types.ts`
- Create: `tests/integration/generation-persistence.test.ts`

- [ ] **Step 1: Write the failing persistence test**

Create a project/schema version, persist a pending job with count, seed, null rate, and LLM policy, then stage two records tied to the job and schema version. Assert project records are unchanged until promotion.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run tests/integration/generation-persistence.test.ts`

Expected: FAIL because `GenerationJob`, `MockRecord`, and staging relations do not exist.

- [ ] **Step 3: Add the minimum models**

Add enums `GenerationStatus`, `GenerationMode`, and `RecordSource`; models `GenerationJob`, `GeneratedRecordStage`, and `MockRecord`; indexes on `(projectId,id)` and `(jobId,ordinal)`; and schema-version foreign keys with restricted deletion.

Required job input type:

```ts
export type GenerationRequest = {
  projectId: string;
  schemaVersionId: string;
  count: number;
  seed: string;
  nullRate: number;
  mode: "FAKER_ONLY" | "HYBRID_LLM";
};
```

- [ ] **Step 4: Migrate and verify GREEN**

```powershell
pnpm prisma migrate dev --name generation
pnpm vitest run tests/integration/generation-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma src/features/generation/job-types.ts tests/integration/generation-persistence.test.ts
git commit -m "feat: persist generation jobs and records"
```

### Task 2: Generate constrained scalar values deterministically

**Files:**
- Create: `src/features/generation/random-source.ts`
- Create: `src/features/generation/scalar-generator.ts`
- Create: `src/features/generation/scalar-generator.test.ts`

- [ ] **Step 1: Write failing deterministic and constraint tests**

For one seed, generate sequences for String, Number, Boolean, Date, Email, Person Name, Product Name, and Address. Assert a repeated run is deeply equal. Loop 1,000 values to prove inclusive range, length, date, and decimal constraints.

```ts
const first = generateScalar(field, createRandomSource("seed-123"));
const second = generateScalar(field, createRandomSource("seed-123"));
expect(first).toEqual(second);
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/generation/scalar-generator.test.ts`

Expected: FAIL because the random source and generator do not exist.

- [ ] **Step 3: Implement a seed-owned random source**

Do not use global faker state or `Math.random`. Expose `integer`, `float`, `boolean`, `pick`, `date`, and a faker instance initialized with Indonesian locale and the derived numeric seed.

- [ ] **Step 4: Implement minimum scalar strategies**

Dispatch by the field discriminant. Clamp faker text to valid lengths without producing an empty result, round numbers to configured precision, use inclusive UTC date bounds, and validate every returned value in development/test.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/generation/scalar-generator.test.ts
git add src/features/generation
git commit -m "feat: generate constrained scalar values"
```

### Task 3: Generate recursive records, arrays, and nulls

**Files:**
- Create: `src/features/generation/record-generator.ts`
- Create: `src/features/generation/record-generator.test.ts`
- Create: `src/features/schema/value-validator.ts`
- Create: `src/features/schema/value-validator.test.ts`

- [ ] **Step 1: Write failing recursive generation tests**

Generate ten records containing nested address object and String array with 1-5 items. Assert each value validates against the snapshot, field order does not change seeded values, and record IDs are never null.

- [ ] **Step 2: Write failing null policy tests**

With null rate 1, assert every non-required field is null and every required field has a value. With null rate 0, assert no value is null. Use a middle rate with a fixed seed and assert deterministic placement.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/generation/record-generator.test.ts src/features/schema/value-validator.test.ts`

Expected: FAIL because record generation and runtime value validation are missing.

- [ ] **Step 4: Implement recursive generation and validation**

Derive a child random source from `(jobSeed,recordOrdinal,stableFieldId)` so reordering fields does not change values. Recurse through objects and array item schemas. Generate a collision-resistant `id` when no schema identifier exists.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/generation/record-generator.test.ts src/features/schema/value-validator.test.ts
git add src/features/generation src/features/schema
git commit -m "feat: generate recursive mock records"
```

### Task 4: Create and claim durable generation jobs

**Files:**
- Create: `src/features/generation/generation-service.ts`
- Create: `src/features/generation/generation-service.test.ts`
- Create: `src/features/generation/job-repository.ts`
- Create: `src/features/generation/job-runner.ts`
- Create: `tests/integration/generation-job.test.ts`

- [ ] **Step 1: Write failing request-validation tests**

Assert missing count returns `Please specify number of records`, count outside 1-10,000 is rejected, empty schema returns the specified schema-empty message, Viewer is forbidden, and an existing dataset returns `REPLACEMENT_CONFIRMATION_REQUIRED` with the exact count.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/generation/generation-service.test.ts`

Expected: FAIL because job creation is missing.

- [ ] **Step 3: Implement job creation**

Authorize `edit_data`, lock/read the current schema version, validate count/null rate/mode, require `confirmedReplacement` when records exist, create a seed if blank, and persist one PENDING job. Return job ID and effective seed.

- [ ] **Step 4: Write the failing claim/idempotency test**

Start two runners against one pending job and assert exactly one transitions it to RUNNING. Re-run a completed job and assert it performs no second promotion.

- [ ] **Step 5: Implement atomic claim and faker-only execution**

Claim with a guarded database update, heartbeat progress, stage generated records in bounded batches, validate them, and promote inside a transaction that deletes old records, inserts staged records, marks project compatible, marks job completed, and appends an audit event.

- [ ] **Step 6: Prove failure preserves old data**

Inject a throwing record generator after staging begins. Assert job FAILED, staging is cleaned or retained only for diagnostics per repository policy, and previous project records remain unchanged.

- [ ] **Step 7: Verify and commit**

```powershell
pnpm vitest run src/features/generation tests/integration/generation-job.test.ts
git add src/features/generation tests/integration
git commit -m "feat: run durable generation jobs"
```

### Task 5: Add hybrid LLM enrichment with faker fallback

**Files:**
- Create: `src/features/generation/llm-provider.ts`
- Create: `src/features/generation/fake-llm-provider.ts`
- Create: `src/features/generation/enrichment-service.ts`
- Create: `src/features/generation/enrichment-service.test.ts`
- Modify: `src/features/generation/job-runner.ts`

- [ ] **Step 1: Write the failing provider-contract tests**

Define the desired provider request with record ordinal, field ID, semantic type, Indonesian locale, constraints, and synthetic neighboring values. Assert secrets, user data, and audit data are absent.

- [ ] **Step 2: Write fallback tests**

Test full success, timeout, thrown error, partial response, invalid value, and quota error. Each failure must retain the seeded faker value, increment the fallback count, and allow job completion.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/generation/enrichment-service.test.ts`

Expected: FAIL because provider and enrichment interfaces do not exist.

- [ ] **Step 4: Implement the provider-neutral interface**

```ts
export interface LlmProvider {
  enrich(request: EnrichmentBatch, signal: AbortSignal): Promise<EnrichmentResult>;
}
```

Implement bounded batch size, timeout via `AbortController`, at most two transient retries, validation through `value-validator`, and deterministic fallback. Do not install or bind a production vendor SDK until a provider is selected during environment setup.

- [ ] **Step 5: Integrate hybrid jobs and verify**

Run enrichment only for marked semantic fields. Store counts for requested, enriched, fallback, and failed batches in `warningSummary`. Confirm fake-provider tests make no network calls.

- [ ] **Step 6: Commit**

```powershell
git add src/features/generation
git commit -m "feat: enrich generated data with llm fallback"
```

### Task 6: Build generation form, progress, and replacement confirmation

**Files:**
- Create: `src/app/(app)/projects/[projectId]/data/page.tsx`
- Create: `src/features/generation/components/generation-form.tsx`
- Create: `src/features/generation/components/generation-form.test.tsx`
- Create: `src/features/generation/components/job-progress.tsx`
- Create: `src/app/(app)/projects/[projectId]/data/actions.ts`
- Create: `src/app/api/projects/[projectId]/generation-jobs/[jobId]/route.ts`

- [x] **Step 1: Write failing form tests**

Assert dynamic button labels (`Generate 10 Records`), missing count error, schema-empty notification, null percentage control, hybrid mode warning, loading state, and exact replacement confirmation text.

- [x] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/generation/components/generation-form.test.tsx`

Expected: FAIL because the form is missing.

- [x] **Step 3: Implement minimum form and Server Action**

Use server-returned field errors, preserve values after failure, disable duplicate submission, and announce progress through an `aria-live` region. Poll the authorized job-status route with bounded backoff and stop on completed/failed/cancelled.

- [x] **Step 4: Verify and commit**

```powershell
pnpm vitest run src/features/generation/components
pnpm typecheck
pnpm lint
git add src/features/generation/components src/app/(app)/projects/[projectId]/data src/app/api/projects
git commit -m "feat: add generation workflow"
```

### Task 7: Build paginated data preview

**Files:**
- Create: `src/features/records/record-query.ts`
- Create: `src/features/records/record-query.test.ts`
- Create: `src/features/records/components/data-preview.tsx`
- Create: `src/features/records/components/data-preview.test.tsx`
- Modify: `src/app/(app)/projects/[projectId]/data/page.tsx`

- [x] **Step 1: Write failing query tests**

Assert page bounds, stable record ordering, total count, Viewer access, and no loading of more than the requested page size.

- [x] **Step 2: Write failing rendering tests**

Assert `Showing 10 of 10 records`, all schema columns, gray/italic null plus literal text `null`, expandable Object JSON, and expandable Array JSON.

- [x] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/records`

Expected: FAIL because queries and preview do not exist.

- [x] **Step 4: Implement query and accessible preview**

Select only one page, derive columns from the record's schema version, render nested JSON in a disclosure control, and show an incompatibility banner with regenerate/delete actions when applicable.

- [x] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/records
pnpm typecheck
git add src/features/records src/app/(app)/projects/[projectId]/data
git commit -m "feat: preview generated records"
```

### Task 8: Prove Phase 3 acceptance and performance

**Files:**
- Create: `tests/acceptance/data-generation.spec.ts`
- Create: `tests/acceptance/nested-data-preview.spec.ts`
- Create: `tests/performance/faker-generation.test.ts`
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

- [ ] **Step 1: Write failing acceptance scenarios**

Cover AC-03.01-03.06, AC-05.05-05.07, AC-08.02, AC-08.05-08.06, seed reproducibility, hybrid fallback notice, and failure preserving old data.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm test:e2e --grep "Phase 3"`

Expected: missing behavior causes a specific acceptance failure.

- [ ] **Step 3: Add the faker performance budget**

Generate and validate 1,000 representative records under the reference environment. Assert duration below 10 seconds, but skip with an explicit reason on resource-constrained CI tiers rather than relaxing the threshold.

- [ ] **Step 4: Apply acceptance-driven fixes and run the full gate**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm vitest run tests/performance/faker-generation.test.ts
pnpm test:e2e --grep "Phase 1|Phase 2|Phase 3"
pnpm build
```

Expected: all commands pass; no test invokes an external LLM.

- [ ] **Step 5: Update traceability and commit**

```powershell
git add tests docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md
git commit -m "test: verify data generation acceptance"
```

