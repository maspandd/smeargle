# Phase 5 Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete import/export, user administration, audit visibility, accessibility, observability, migration recovery, security validation, and production release readiness.

**Architecture:** Add operational capabilities through existing domain services and audit boundaries rather than privileged database shortcuts. Release checks run against a production build and disposable PostgreSQL environment using documented, repeatable commands.

**Tech Stack:** Existing platform stack, structured logging, health/metrics adapters, axe accessibility checks, Playwright, dependency and secret scanning supplied by CI

---

### Task 1: Import and export project schemas safely

**Files:**
- Create: `src/features/schema/schema-export.ts`
- Create: `src/features/schema/schema-export.test.ts`
- Create: `src/features/schema/schema-import.ts`
- Create: `src/features/schema/schema-import.test.ts`
- Create: `src/app/api/projects/[projectId]/schema/export/route.ts`
- Create: `src/app/(app)/projects/[projectId]/settings/import-actions.ts`
- Create: `src/features/schema/components/schema-import-dialog.tsx`

- [ ] **Step 1: Write the failing round-trip test**

Export a recursive schema, parse the JSON, import it into a new project, and assert semantic equality of fields, order, constraints, and stable IDs where valid.

Required envelope:

```ts
type SchemaExport = {
  format: "mock-data-generator-schema";
  formatVersion: 1;
  project: { name: string; baseEndpoint: string; locale: "id-ID" };
  version: { label: string; createdAt: string };
  schema: SchemaSnapshot;
};
```

- [ ] **Step 2: Write malformed/untrusted import tests**

Reject wrong format/version, invalid JSON, excessive nesting/fields, duplicate IDs/names, unsafe endpoint, unknown keys that change semantics, and files over the documented size cap. Assert errors include safe JSON paths and never echo the entire uploaded document.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/schema/schema-export.test.ts src/features/schema/schema-import.test.ts`

Expected: FAIL because import/export services do not exist.

- [ ] **Step 4: Implement pure serialization and parsing**

Serialize in stable field order. Parse through the same recursive domain parser. Import requires `edit_schema`, previews the diff, requires confirmation, and creates one new schema version through `mutateSchema`; it never updates snapshots directly.

- [ ] **Step 5: Add route/dialog and verify**

Export returns attachment JSON. Import dialog accepts `.json`, validates client size and server content, shows diff/compatibility, and preserves the current schema on any failure.

- [ ] **Step 6: Commit**

```powershell
pnpm vitest run src/features/schema
git add src/features/schema src/app
git commit -m "feat: import and export schemas"
```

### Task 2: Add system user administration

**Files:**
- Create: `src/features/auth/admin-service.ts`
- Create: `src/features/auth/admin-service.test.ts`
- Create: `src/app/(app)/admin/users/page.tsx`
- Create: `src/app/(app)/admin/users/actions.ts`
- Create: `src/features/auth/components/user-admin-table.tsx`

- [ ] **Step 1: Write failing administrator authorization tests**

Assert system Admin can create a user, disable/enable an account, and change system role; ordinary Owner cannot. Assert an Admin cannot disable or demote the last active system Admin.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/auth/admin-service.test.ts`

Expected: FAIL because the admin service does not exist.

- [ ] **Step 3: Implement transactional admin mutations**

Normalize email, hash initial password, require password change on first login if that policy is selected, revoke sessions on disable, protect the last active Admin, and append audit events without password material.

- [ ] **Step 4: Build the admin UI test-first**

Add component tests for Admin-only navigation, account status, role controls, confirmation, field errors, and hidden access for ordinary users. Implement only after observing failures.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/auth
pnpm typecheck
pnpm lint
git add src/features/auth src/app/(app)/admin
git commit -m "feat: administer internal users"
```

### Task 3: Expose an authorized audit trail

**Files:**
- Create: `src/features/audit/audit-query.ts`
- Create: `src/features/audit/audit-query.test.ts`
- Create: `src/features/audit/redaction.ts`
- Create: `src/features/audit/redaction.test.ts`
- Create: `src/app/(app)/projects/[projectId]/audit/page.tsx`
- Create: `src/features/audit/components/audit-table.tsx`

- [ ] **Step 1: Write failing redaction tests**

Pass metadata containing keys named token, password, authorization, secret, API key, and nested variants. Assert returned metadata contains `[REDACTED]` and unrelated IDs/summaries remain.

- [ ] **Step 2: Write failing query tests**

Assert Owner can page/filter project events, Viewer cannot access the audit page, system Admin can, ordering is stable newest-first, and one query never returns more than the page cap.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/features/audit`

Expected: FAIL because audit query/redaction do not exist.

- [ ] **Step 4: Implement redacted querying and UI**

Apply redaction before persistence where possible and again before display. Render actor, action, target, timestamp, summary, and expandable safe metadata. Do not expose payload JSON or credential hashes.

- [ ] **Step 5: Verify mutation coverage**

Add an integration table test proving project, membership, schema, generation, credential, runtime write, import, rollback, and admin mutations each append the expected audit action.

- [ ] **Step 6: Commit**

```powershell
pnpm vitest run src/features/audit tests/integration
git add src/features/audit src/app/(app)/projects tests/integration
git commit -m "feat: expose project audit history"
```

### Task 4: Add structured logging and health checks

**Files:**
- Create: `src/lib/logger.ts`
- Create: `src/lib/logger.test.ts`
- Create: `src/features/operations/health-service.ts`
- Create: `src/features/operations/health-service.test.ts`
- Create: `src/app/api/health/live/route.ts`
- Create: `src/app/api/health/ready/route.ts`
- Modify: `src/features/mock-runtime/json-response.ts`
- Modify: `src/features/generation/job-runner.ts`

- [ ] **Step 1: Write failing structured-log tests**

Assert logs are JSON objects with level, message, timestamp, requestId, projectId, schemaVersionId, jobId, and safe error classification. Assert tokens, cookies, passwords, provider secrets, and record payloads are redacted.

- [ ] **Step 2: Write failing health tests**

Liveness succeeds without dependencies. Readiness checks database and job claim loop; optional LLM connectivity is reported as degraded rather than making faker-only service unavailable.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run src/lib/logger.test.ts src/features/operations/health-service.test.ts`

Expected: FAIL because logging and health services do not exist.

- [ ] **Step 4: Implement adapters and instrument boundaries**

Use one logger interface with environment-specific sink. Add request start/end/error logs and job lifecycle logs. Avoid logging full request/response bodies. Return minimal unauthenticated health JSON.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/lib/logger.test.ts src/features/operations
git add src/lib src/features/operations src/features/mock-runtime src/features/generation src/app/api/health
git commit -m "feat: add operations health and logging"
```

### Task 5: Complete keyboard and screen-reader accessibility

**Files:**
- Create: `tests/acceptance/accessibility.spec.ts`
- Modify: `src/features/**/components/*.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing automated accessibility checks**

Install and configure the project-approved axe Playwright integration with a pinned version. Test login, dashboard, project dialog, schema editor, generation page, preview, API workspace, version comparison, members, and admin pages for serious/critical violations.

- [ ] **Step 2: Write failing keyboard flows**

Use only Tab, Shift+Tab, Enter, Space, Escape, and arrow keys to create a project, add/edit/delete a field, confirm regeneration, expand nested JSON, and close every dialog. Assert focus returns to the invoking control.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm test:e2e --grep "Accessibility"`

Expected: initial violations or focus-order failures are reported precisely.

- [ ] **Step 4: Fix production semantics minimally**

Add landmarks, headings, labels, descriptions, live regions, dialog focus traps/restoration, non-color diff labels, visible focus, adequate target sizes, and table captions. Do not suppress axe rules without a documented false-positive reproduction.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test:e2e --grep "Accessibility"
pnpm lint
pnpm typecheck
git add src tests/acceptance/accessibility.spec.ts package.json pnpm-lock.yaml
git commit -m "fix: complete platform accessibility"
```

### Task 6: Prove migrations, backup, and recovery

**Files:**
- Create: `scripts/verify-migrations.ps1`
- Create: `scripts/backup-database.ps1`
- Create: `scripts/restore-database.ps1`
- Create: `docs/operations/database-recovery.md`
- Create: `tests/operations/migration-recovery.test.ts`

- [ ] **Step 1: Write the failing migration rehearsal test**

Provision a disposable empty PostgreSQL database, apply every migration, seed representative v1 data, verify current schema, and run the documented rollback/restore rehearsal. The test must use an explicitly named disposable database and refuse production-like hosts/names.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run tests/operations/migration-recovery.test.ts`

Expected: FAIL because scripts and recovery documentation do not exist.

- [ ] **Step 3: Implement guarded PowerShell scripts**

Accept database URL as a required parameter, validate the target name prefix `mdg_test_`, call native PostgreSQL dump/restore tools without printing credentials, propagate nonzero exits, and record checksums/timestamps.

- [ ] **Step 4: Document recovery objectives**

Document owners, prerequisites, backup frequency, restore verification, secret retrieval, recovery point/time objectives selected by operations, and escalation. Do not invent organizational contacts or unapproved numeric objectives.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run tests/operations/migration-recovery.test.ts
git add scripts docs/operations tests/operations
git commit -m "chore: document database recovery"
```

### Task 7: Add security and dependency gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/security/threat-model.md`
- Create: `tests/security/authorization-matrix.test.ts`
- Create: `tests/security/secret-redaction.test.ts`

- [ ] **Step 1: Write failing authorization-matrix tests**

Enumerate every authenticated Server Action/Route Handler and verify unauthenticated, non-member, Viewer, Editor, Owner, and system Admin outcomes. Enumerate public routes separately with token-required and anonymous policies.

- [ ] **Step 2: Write failing secret-leak tests**

Inject known canary password/token/provider secret values, trigger validation and unexpected errors, capture response/log/audit output, and assert canaries never appear.

- [ ] **Step 3: Run to verify RED**

Run: `pnpm vitest run tests/security`

Expected: tests identify any unregistered route or unsafe output before the gate is considered green.

- [ ] **Step 4: Fix coverage gaps and define CI**

CI installs from the frozen lockfile, generates Prisma client, runs lint/typecheck/unit/integration/security/browser/build, scans dependencies and repository secrets using organization-approved tools, and uploads test reports without database dumps or secrets.

- [ ] **Step 5: Write the threat model**

Cover credential stuffing, session theft, CSRF, broken object authorization, route-key discovery, token leakage, JSON injection, resource exhaustion, LLM prompt/data leakage, malicious schema imports, audit tampering, and dependency compromise. Link each threat to implemented controls and tests.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run tests/security
pnpm lint
pnpm typecheck
git add .github docs/security tests/security src
git commit -m "security: enforce platform release gates"
```

### Task 8: Run the complete release rehearsal

**Files:**
- Create: `docs/operations/release-checklist.md`
- Create: `docs/operations/runbook.md`
- Create: `docs/product/acceptance-report.md`
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

- [ ] **Step 1: Build the acceptance report from executed evidence**

For all 47 source ACs and added criteria, record test path, last result, environment, and evidence link. Do not mark manual or skipped scenarios as passed.

- [ ] **Step 2: Run the production-build rehearsal**

```powershell
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm vitest run tests/security tests/operations tests/performance
pnpm build
pnpm test:e2e
```

Expected: all required commands exit 0, skipped tests have approved documented reasons, and no logs contain canary secrets.

- [ ] **Step 3: Verify operational flows**

Against a disposable production build, verify health endpoints, account disable/session revocation, project creation, schema/version/rollback, faker and fake-LLM generation, complete CRUD, token rotation, rate limiting, backup, and restore.

- [ ] **Step 4: Record residual risk and rollback criteria**

Document known low/medium findings, ownership, target dates, deployment rollback triggers, migration rollback/restore decision tree, and monitoring checks. Critical/high findings block release.

- [ ] **Step 5: Commit the release evidence**

```powershell
git add docs/operations docs/product docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md
git commit -m "docs: complete platform release rehearsal"
```

