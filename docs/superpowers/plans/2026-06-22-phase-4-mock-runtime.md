# Phase 4 Mock Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose project data through stable, secure, schema-validated collection and record CRUD endpoints that behave like a production JSON API.

**Architecture:** One catch-all public Route Handler resolves route key and resource, applies CORS/rate-limit/token policies, then delegates to method-specific domain services. Services use the current schema and record repository; UI and runtime share value validation but not authentication.

**Tech Stack:** Next.js Route Handlers, Zod, Prisma/PostgreSQL JSONB, Web Crypto token hashing, structured JSON errors, Vitest route integration tests, Playwright/APIRequestContext, load tests

---

### Task 1: Resolve stable public routes and JSON errors

**Files:**
- Create: `src/features/mock-runtime/runtime-context.ts`
- Create: `src/features/mock-runtime/runtime-context.test.ts`
- Create: `src/features/mock-runtime/runtime-error.ts`
- Create: `src/features/mock-runtime/json-response.ts`
- Create: `src/app/api/mock/[routeKey]/[...segments]/route.ts`

- [ ] **Step 1: Write failing route-resolution tests**

Resolve `products_test_key/products` to the project configured with `/api/products`. Reject unknown route key as `PROJECT_NOT_FOUND`, wrong resource as `RESOURCE_NOT_FOUND`, extra segments as `RECORD_NOT_FOUND`, and disabled HTTP method as `METHOD_DISABLED`.

- [ ] **Step 2: Write failing error-envelope tests**

Assert errors contain `error.code`, safe `message`, optional `details`, and generated `requestId`; every response has `Content-Type: application/json` and never includes a Next.js HTML error page.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/runtime-context.test.ts`

Expected: FAIL because runtime context and errors do not exist.

- [ ] **Step 4: Implement context and response helpers**

Normalize URL-decoded segments, read projects by stable route key, derive resource from the last base-endpoint segment, load current schema/data status/runtime policy, and generate a request ID per request. Map typed errors to 400/401/403/404/409/422/429/500.

- [ ] **Step 5: Add the thin route dispatcher**

Export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS` handlers that call one `handleRuntimeRequest(request,params)` dispatcher and catch all errors through `toJsonErrorResponse`.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/features/mock-runtime/runtime-context.test.ts
pnpm typecheck
git add src/features/mock-runtime src/app/api/mock
git commit -m "feat: resolve public mock routes"
```

### Task 2: Implement collection and record GET

**Files:**
- Create: `src/features/mock-runtime/read-service.ts`
- Create: `src/features/mock-runtime/read-service.test.ts`
- Create: `tests/integration/mock-get-route.test.ts`

- [ ] **Step 1: Write failing collection GET tests**

Assert ten records return status 200 and `{data,meta:{count,endpoint,projectId}}`; an empty project returns an empty array and count zero; unknown project returns the supplied 404 shape plus request ID.

- [ ] **Step 2: Write failing query tests**

Assert bounded `page`/`pageSize`, stable sort by an allowed scalar field, exact-match scalar filters, rejection of nested/unknown sort fields, and total count independent of page size.

- [ ] **Step 3: Write failing record GET tests**

Assert a known ID returns one object and unknown ID returns JSON 404 without leaking database IDs.

- [ ] **Step 4: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/read-service.test.ts tests/integration/mock-get-route.test.ts`

Expected: FAIL because GET services are missing.

- [ ] **Step 5: Implement safe reads**

Whitelist sort/filter fields from the parsed schema. Use parameterized Prisma queries; where JSONB query capabilities are insufficient or unsafe, add an indexed projection table rather than interpolate SQL. Cap page size at 100 and use record ID as a stable secondary sort.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/features/mock-runtime/read-service.test.ts tests/integration/mock-get-route.test.ts
git add src/features/mock-runtime tests/integration
git commit -m "feat: read mock api records"
```

### Task 3: Implement schema-validated POST

**Files:**
- Create: `src/features/mock-runtime/write-service.ts`
- Create: `src/features/mock-runtime/write-service.test.ts`
- Create: `tests/integration/mock-post-route.test.ts`

- [ ] **Step 1: Write failing POST tests**

Assert valid JSON creates a record with generated ID and 201; later GET count increases. Assert malformed JSON is 400, wrong field type is 422 with `{path,message}`, duplicate explicit ID is 409, and incompatible project data blocks writes with 409.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/write-service.test.ts tests/integration/mock-post-route.test.ts`

Expected: FAIL because POST behavior is missing.

- [ ] **Step 3: Implement POST minimally**

Parse request JSON once, validate through `value-validator` against the current snapshot, generate an ID when absent, store the current schema version, append a runtime mutation audit event without full payload or secrets, and return the public payload.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm vitest run src/features/mock-runtime/write-service.test.ts tests/integration/mock-post-route.test.ts
git add src/features/mock-runtime tests/integration
git commit -m "feat: create mock api records"
```

### Task 4: Implement PUT, PATCH, and DELETE

**Files:**
- Modify: `src/features/mock-runtime/write-service.ts`
- Modify: `src/features/mock-runtime/write-service.test.ts`
- Create: `tests/integration/mock-record-write-routes.test.ts`

- [ ] **Step 1: Write failing PUT tests**

Assert PUT replaces the full record while preserving URL ID, rejects missing required fields, rejects body/URL ID mismatch, and returns 404 for a missing record.

- [ ] **Step 2: Write failing PATCH tests**

Assert PATCH merges a partial object, validates the complete merged record, supports explicit null only where allowed, and rejects an empty or non-object patch.

- [ ] **Step 3: Write failing DELETE tests**

Assert existing record deletion returns 204 with no body, later GET is 404, and deleting an unknown record is 404.

- [ ] **Step 4: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/write-service.test.ts tests/integration/mock-record-write-routes.test.ts`

Expected: new PUT/PATCH/DELETE tests fail because handlers are unimplemented.

- [ ] **Step 5: Implement record writes transactionally**

Reuse context, current schema validation, compatibility guard, and error mapping. Update `schemaVersionId` on successful writes and append one audit event containing method and record ID only.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/features/mock-runtime tests/integration/mock-record-write-routes.test.ts
git add src/features/mock-runtime tests/integration
git commit -m "feat: update and delete mock api records"
```

### Task 5: Add API credential lifecycle

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_api_credentials/migration.sql`
- Create: `src/features/mock-runtime/credential-service.ts`
- Create: `src/features/mock-runtime/credential-service.test.ts`
- Create: `src/features/mock-runtime/token-auth.ts`
- Create: `src/features/mock-runtime/token-auth.test.ts`
- Create: `src/app/(app)/projects/[projectId]/api/actions.ts`

- [ ] **Step 1: Write failing credential tests**

Create a token and assert plaintext is returned exactly once, only its SHA-256 hash persists, labels are required, expired/revoked tokens fail, last-used time updates without blocking the request, and rotation does not revive the old token.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/credential-service.test.ts src/features/mock-runtime/token-auth.test.ts`

Expected: FAIL because credential persistence and services do not exist.

- [ ] **Step 3: Add credential persistence and services**

Require `manage_api`, generate 32 random bytes as base64url, hash before storage, compare hashes in constant time, support optional expiry and revocation, and append audit events without plaintext tokens.

- [ ] **Step 4: Enforce project policy**

When `tokenRequired=false`, allow anonymous runtime access. When true, require `Authorization: Bearer <token>` and return the same 401 response for missing, invalid, expired, or revoked tokens.

- [ ] **Step 5: Migrate, verify, and commit**

```powershell
pnpm prisma migrate dev --name api_credentials
pnpm vitest run src/features/mock-runtime
git add prisma src/features/mock-runtime src/app/(app)/projects/[projectId]/api
git commit -m "feat: secure mock api with tokens"
```

### Task 6: Add CORS and rate limiting

**Files:**
- Create: `src/features/mock-runtime/cors-policy.ts`
- Create: `src/features/mock-runtime/cors-policy.test.ts`
- Create: `src/features/mock-runtime/rate-limit.ts`
- Create: `src/features/mock-runtime/rate-limit.test.ts`
- Modify: `src/app/api/mock/[routeKey]/[...segments]/route.ts`

- [ ] **Step 1: Write failing CORS tests**

Assert no `Origin` is allowed, exact configured origins receive matching headers, unlisted origins receive 403, wildcard is explicit rather than implicit, OPTIONS returns allowed methods/headers, and `Vary: Origin` is present.

- [ ] **Step 2: Write failing rate-limit tests**

Using a fake clock and repository, assert limits are scoped by route key plus token hash or client IP, include standard limit/remaining/reset headers, return 429 after threshold, and recover after the window.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/cors-policy.test.ts src/features/mock-runtime/rate-limit.test.ts`

Expected: FAIL because policies are absent.

- [ ] **Step 4: Implement policy adapters**

Keep CORS pure and testable. Implement the initial limiter with PostgreSQL atomic counters and expiry cleanup behind `RateLimitStore`; do not trust forwarded IP headers unless the deployment proxy is explicitly configured.

- [ ] **Step 5: Apply middleware order and verify**

Order: request ID, route resolution, CORS, rate limit, token auth, method service. Ensure OPTIONS does not mutate data and has a separately bounded limit.

- [ ] **Step 6: Commit**

```powershell
git add src/features/mock-runtime src/app/api/mock
git commit -m "feat: enforce mock api cors and rate limits"
```

### Task 7: Build the Mock API workspace

**Files:**
- Create: `src/app/(app)/projects/[projectId]/api/page.tsx`
- Create: `src/features/mock-runtime/components/api-overview.tsx`
- Create: `src/features/mock-runtime/components/credential-manager.tsx`
- Create: `src/features/mock-runtime/components/runtime-settings.tsx`
- Create: `src/features/mock-runtime/components/api-overview.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert exact collection/record URLs, method list, curl examples, copy controls, token shown once, revocation confirmation, CORS validation, rate-limit fields, and Viewer read-only state.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/mock-runtime/components`

Expected: FAIL because the workspace components do not exist.

- [ ] **Step 3: Implement the minimum workspace**

Render URLs from server-provided route context, never reconstruct them from untrusted client strings. Show token plaintext in a one-time dialog with explicit close warning. Provide examples without placing tokens in query strings.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm vitest run src/features/mock-runtime/components
pnpm typecheck
pnpm lint
git add src/features/mock-runtime/components src/app/(app)/projects/[projectId]/api
git commit -m "feat: add mock api workspace"
```

### Task 8: Prove Phase 4 acceptance, security, and performance

**Files:**
- Create: `tests/acceptance/mock-api.spec.ts`
- Create: `tests/acceptance/mock-api-security.spec.ts`
- Create: `tests/performance/mock-get-load.test.ts`
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

- [ ] **Step 1: Write failing HTTP acceptance scenarios**

Cover AC-04.01-04.04 plus record GET/PUT/PATCH/DELETE, validation 422, incompatible-write 409, token lifecycle, CORS, rate limiting, pagination, sorting, and filtering.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm test:e2e --grep "Phase 4"`

Expected: a missing runtime behavior causes a precise API assertion failure.

- [ ] **Step 3: Add the GET performance test**

Seed at least 1,000 records, warm the application, request a 100-record page at representative concurrency, and calculate p95. Assert p95 below 200 ms in the reference environment and record hardware/DB configuration with the result.

- [ ] **Step 4: Apply minimal fixes and run the full gate**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm vitest run tests/performance/mock-get-load.test.ts
pnpm test:e2e --grep "Phase 1|Phase 2|Phase 3|Phase 4"
pnpm build
```

Expected: all commands pass; runtime errors remain JSON-only.

- [ ] **Step 5: Update traceability and commit**

```powershell
git add tests docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md
git commit -m "test: verify mock runtime acceptance"
```

