# Phase 2 Schema Versioning Micro-Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan one micro-task at a time. Do not spawn subagents unless the user explicitly asks for parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 2 schema editing and versioning through small PR-sized tasks that minimize token usage and keep each implementation session narrow.

**Architecture:** Keep the original Phase 2 architecture: schema state lives in immutable schema-version snapshots, schema mutations are transactionally versioned, and UI follows the Figma schema-builder reference. This micro-plan changes delivery order only; it does not change the approved specification.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Prisma/PostgreSQL JSON, Vitest, Testing Library, Playwright.

---

## Usage Rules

- Implement exactly one micro-task per session.
- Read only this micro-plan, the source files listed in the selected task, and nearby existing code.
- Write the failing test first.
- Run the focused test and confirm the expected failure.
- Implement the minimum code for the selected task.
- Run focused tests locally.
- Push a PR and let GitHub CI run the full suite.
- Do not start Phase 3.
- Do not reopen Figma unless the local docs are insufficient; use `docs/design/figma-phase-map.md` and `docs/design/figma-design.md` first.

## Required Source References

Read these at the start of each Phase 2 session:

- `docs/superpowers/plans/2026-06-23-phase-2-schema-versioning-micro-plan.md`

Read these only when needed for a task:

- `docs/superpowers/plans/2026-06-22-phase-2-schema-versioning.md`
- `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`
- `docs/design/figma-phase-map.md`
- `docs/design/figma-design.md`

## Local Verification Policy

Use focused commands while developing:

```bash
pnpm vitest run <focused-test-file>
pnpm run typecheck
pnpm run lint
```

Use database tests only for tasks that touch Prisma or transactional behavior:

```bash
pnpm vitest run tests/integration/<focused-test-file>
```

Use Playwright only for UI/acceptance tasks:

```bash
pnpm exec playwright test tests/acceptance/<focused-spec>
```

Let GitHub CI run the full release gate after each PR.

## Micro-Task Overview

| Micro-task | Scope | Primary acceptance criteria | Figma reference | Suggested PR title |
|---:|---|---|---|---|
| 1 | Schema domain parser | AC-02.03, AC-05.04, AC-08.01, AC-08.03 | Schema with fields | Define recursive schema domain |
| 2 | Schema version persistence | AC-09.01, AC-09.10 | Version badge | Persist schema versions |
| 3 | Pure schema mutations | AC-02.01, AC-02.04, AC-07.02, AC-07.03 | Add Field, row menu | Add schema mutation primitives |
| 4 | Transactional schema service | AC-06.01, AC-06.03, AC-07.01, AC-09.07, AC-09.08 | Add Field, row menu | Version schema mutations transactionally |
| 5 | Minimal schema builder UI | AC-02.01, AC-02.02, AC-02.04, AC-05.01, AC-05.02, AC-05.03 | Schema with fields | Add schema builder UI |
| 6 | Nested fields UI | AC-08.01, AC-08.03, AC-08.04 | Expanded address object | Add recursive field editing |
| 7 | Compatibility classification | AC-06.03, AC-09.05 | No direct frame | Classify schema compatibility |
| 8 | Version history and diff | AC-09.02, AC-09.03, AC-09.04 | Reuse schema shell | Show schema version history |
| 9 | Rollback and download | AC-09.05, AC-09.06, AC-09.09 | Reuse schema shell | Roll back and export schemas |
| 10 | Phase 2 acceptance proof | AC-02, AC-05, AC-06, AC-07, AC-08, AC-09 | Schema with fields | Verify Phase 2 acceptance |

## Micro-Task 1: Schema Domain Parser

**Purpose:** Define the recursive schema snapshot format and validation rules without touching the database or UI.

**Files likely touched:**

- Create: `src/features/schema/schema-types.ts`
- Create: `src/features/schema/schema-parser.ts`
- Create: `src/features/schema/schema-parser.test.ts`
- Create: `src/features/schema/field-id.ts`

**Tests to write first:**

- `parseSchema` accepts a constrained String field.
- `parseSchema` accepts a constrained Number field.
- `parseSchema` accepts an Object with nested fields.
- `parseSchema` accepts an Array with an item schema.
- `parseSchema` rejects duplicate sibling names.
- `parseSchema` rejects invalid min/max constraints.
- `parseSchema` rejects more than five nesting levels.
- `parseSchema` rejects more than 100 direct fields.
- `parseSchema` removes or rejects obsolete constraints when a field type changes.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/schema-parser.test.ts
pnpm run typecheck
```

**Stop condition:** Domain tests pass and no Prisma, route, or UI files are changed.

## Micro-Task 2: Schema Version Persistence

**Purpose:** Add immutable schema-version storage and wire project creation to an initial empty v1.0 snapshot.

**Files likely touched:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_schema_versions/migration.sql`
- Create: `src/features/versions/version-service.ts`
- Create: `src/features/versions/version-service.test.ts`
- Modify: `src/features/projects/project-service.ts`
- Modify: `src/features/projects/project-service.test.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Tests to write first:**

- Creating a project creates one `SchemaVersion` row with `{ fields: [] }`.
- The project points to the current schema version.
- The initial version displays as `v1.0`.
- Version rows are create-only through the service API.
- Dashboard project list can read the current version label.

**Focused tests to run:**

```bash
pnpm vitest run src/features/versions/version-service.test.ts src/features/projects/project-service.test.ts
pnpm run typecheck
```

**Database verification to run:**

```bash
pnpm prisma migrate dev --name schema_versions
```

**Stop condition:** New projects have v1.0 schema snapshots, existing Phase 1 project behavior remains green, and no schema mutation behavior is added yet.

## Micro-Task 3: Pure Schema Mutation Primitives

**Purpose:** Add immutable in-memory schema operations before database transactions.

**Files likely touched:**

- Create: `src/features/schema/schema-mutations.ts`
- Create: `src/features/schema/schema-mutations.test.ts`
- Modify: `src/features/schema/schema-types.ts`
- Modify: `src/features/schema/schema-parser.ts`

**Tests to write first:**

- `addField` appends a String field.
- `addField` rejects duplicate sibling names.
- `editField` preserves field ID while changing label, type, and constraints.
- `editField` clears obsolete constraints when type changes.
- `deleteField` removes a field by stable ID.
- `reorderField` changes order without changing IDs.
- Nested add/edit/delete works inside an Object.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/schema-mutations.test.ts src/features/schema/schema-parser.test.ts
pnpm run typecheck
```

**Stop condition:** Pure mutation tests pass and no database/service/UI behavior is added.

## Micro-Task 4: Transactional Schema Service

**Purpose:** Connect pure mutations to project authorization, immutable versions, audit events, and stale-version protection.

**Files likely touched:**

- Create: `src/features/schema/schema-service.ts`
- Create: `src/features/schema/schema-service.test.ts`
- Create: `tests/integration/schema-transaction.test.ts`
- Modify: `src/features/projects/authorization.ts`
- Modify: `prisma/schema.prisma` if new audit enum values are required.
- Create: `prisma/migrations/<timestamp>_schema_audit_events/migration.sql` if audit enum values are required.

**Tests to write first:**

- Owner can add a field and create `v1.1`.
- Editor can add a field.
- Viewer cannot mutate schema.
- Stale expected version returns a version-conflict result.
- Mutating a schema creates one new version, updates the project pointer, and appends one audit event.
- Duplicate sibling name causes no new version and no audit event.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/schema-service.test.ts tests/integration/schema-transaction.test.ts
pnpm run typecheck
```

**Stop condition:** Server-side schema mutations are transactional, authorized, and versioned; UI is still unchanged.

## Micro-Task 5: Minimal Schema Builder UI

**Purpose:** Build the first usable schema-builder screen that follows the Figma shell and supports scalar fields.

**Files likely touched:**

- Modify: `src/app/(app)/projects/[projectId]/page.tsx`
- Create: `src/app/(app)/projects/[projectId]/schema/actions.ts`
- Create: `src/features/schema/components/schema-builder.tsx`
- Create: `src/features/schema/components/schema-builder.test.tsx`
- Create: `src/features/schema/components/field-dialog.tsx`
- Create: `src/features/schema/components/field-dialog.test.tsx`
- Create: `src/features/schema/components/field-row.tsx`
- Create: `tests/acceptance/schema-builder.spec.ts`

**Tests to write first:**

- Field dialog shows String constraints when String is selected.
- Field dialog shows Number constraints when Number is selected.
- Field dialog shows Date constraints when Date is selected.
- Switching field type removes obsolete controls.
- Adding a String field renders it in the field list.
- Adding an Email semantic field renders the `LLM-Powered` badge.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/components/field-dialog.test.tsx src/features/schema/components/schema-builder.test.tsx
pnpm exec playwright test tests/acceptance/schema-builder.spec.ts
pnpm run typecheck
```

**Stop condition:** Scalar field creation works through the UI; nested fields, version history, rollback, and data compatibility remain out of scope.

## Micro-Task 6: Nested Fields UI

**Purpose:** Add recursive object and array editing to the schema-builder UI.

**Files likely touched:**

- Modify: `src/features/schema/components/schema-builder.tsx`
- Modify: `src/features/schema/components/field-dialog.tsx`
- Create: `src/features/schema/components/nested-fields-editor.tsx`
- Create: `src/features/schema/components/nested-fields-editor.test.tsx`
- Modify: `tests/acceptance/schema-builder.spec.ts`
- Create: `tests/acceptance/nested-schema.spec.ts`

**Tests to write first:**

- Object field can be added.
- Nested String field can be added under an Object.
- Object row expands and collapses nested fields.
- Array field can be added with a constrained item schema.
- UI prevents nesting beyond level five.
- UI prevents more than 100 direct fields.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/components/nested-fields-editor.test.tsx src/features/schema/components/field-dialog.test.tsx
pnpm exec playwright test tests/acceptance/nested-schema.spec.ts
pnpm run typecheck
```

**Stop condition:** Recursive field editing is usable and accessible; generated data preview is not implemented.

## Micro-Task 7: Compatibility Classification

**Purpose:** Determine whether schema changes are compatible, transformable, or require regeneration without building Phase 3 generation.

**Files likely touched:**

- Create: `src/features/schema/compatibility.ts`
- Create: `src/features/schema/compatibility.test.ts`
- Create: `src/features/records/record-transform.ts`
- Create: `src/features/records/record-transform.test.ts`
- Modify: `src/features/schema/schema-service.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_project_data_status/migration.sql`

**Tests to write first:**

- Optional field add is compatible.
- Widened String and Number constraints are compatible.
- Field deletion is transformable.
- Field rename is transformable.
- Required field add is incompatible.
- Narrowed constraints are incompatible.
- Type changes are incompatible.
- Deleting nested keys transforms JSON records without touching unrelated values.

**Focused tests to run:**

```bash
pnpm vitest run src/features/schema/compatibility.test.ts src/features/records/record-transform.test.ts src/features/schema/schema-service.test.ts
pnpm run typecheck
```

**Stop condition:** Compatibility metadata exists and schema transactions mark data status correctly; no generation UI or table preview is added.

## Micro-Task 8: Version History And Diff

**Purpose:** Display version history and compare schema versions.

**Files likely touched:**

- Create: `src/features/versions/schema-diff.ts`
- Create: `src/features/versions/schema-diff.test.ts`
- Create: `src/features/versions/version-query.ts`
- Create: `src/features/versions/components/version-history.tsx`
- Create: `src/features/versions/components/version-history.test.tsx`
- Create: `src/features/versions/components/version-comparison.tsx`
- Create: `src/features/versions/components/version-comparison.test.tsx`
- Create: `src/app/(app)/projects/[projectId]/versions/page.tsx`
- Create: `tests/acceptance/schema-versions.spec.ts`

**Tests to write first:**

- Diff identifies added, deleted, renamed, reordered, and constraint-modified fields by stable ID.
- Diff includes nested field paths.
- History lists versions newest first.
- History displays actor, timestamp, version label, and change summary.
- Comparison does not rely on color alone to communicate added/deleted/modified.

**Focused tests to run:**

```bash
pnpm vitest run src/features/versions/schema-diff.test.ts src/features/versions/components/version-history.test.tsx src/features/versions/components/version-comparison.test.tsx
pnpm exec playwright test tests/acceptance/schema-versions.spec.ts
pnpm run typecheck
```

**Stop condition:** Users can inspect history and compare versions; rollback and JSON download remain out of scope.

## Micro-Task 9: Rollback And JSON Download

**Purpose:** Add rollback-as-new-version and schema snapshot download.

**Files likely touched:**

- Create: `src/features/versions/rollback-service.ts`
- Create: `src/features/versions/rollback-service.test.ts`
- Create: `src/app/(app)/projects/[projectId]/versions/actions.ts`
- Create: `src/app/api/projects/[projectId]/versions/[versionId]/download/route.ts`
- Create: `tests/integration/schema-download.test.ts`
- Modify: `tests/acceptance/schema-versions.spec.ts`

**Tests to write first:**

- Rolling back from `v1.4` to `v1.2` creates `v1.5`.
- Rollback preserves historical versions.
- Rollback stores `restoredFromId`.
- Incompatible rollback marks data status as incompatible.
- Cancelled rollback creates no version.
- Download route returns JSON with project metadata, version metadata, and snapshot.
- Download route sanitizes filename.
- Viewer can download; non-member receives forbidden response.

**Focused tests to run:**

```bash
pnpm vitest run src/features/versions/rollback-service.test.ts tests/integration/schema-download.test.ts
pnpm exec playwright test tests/acceptance/schema-versions.spec.ts
pnpm run typecheck
```

**Stop condition:** Rollback and export acceptance criteria pass; no Phase 3 generation behavior is added.

## Micro-Task 10: Phase 2 Acceptance Proof

**Purpose:** Add the final acceptance coverage and traceability update for Phase 2.

**Files likely touched:**

- Create: `tests/acceptance/schema-fields.spec.ts`
- Create: `tests/acceptance/schema-constraints.spec.ts`
- Create: `tests/acceptance/nested-schema.spec.ts` if not already created.
- Create: `tests/acceptance/schema-versions.spec.ts` if not already created.
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

**Tests to write first:**

- AC-02.01 adds a constrained String field.
- AC-02.02 adds an Email semantic field and displays the badge.
- AC-02.03 rejects duplicate sibling field names.
- AC-02.04 adds a constrained Number field.
- AC-05.01 through AC-05.04 persist and validate constraints.
- AC-06.01 through AC-06.03 cover delete, cancel delete, and record impact behavior.
- AC-07.01 through AC-07.03 cover edit/versioning/type-change/duplicate rename behavior.
- AC-08.01, AC-08.03, and AC-08.04 cover Object, Array, and expansion behavior.
- AC-09.01 through AC-09.10 cover version display, history, comparison, rollback, download, and dashboard version badge.

**Focused tests to run:**

```bash
pnpm exec playwright test tests/acceptance/schema-fields.spec.ts tests/acceptance/schema-constraints.spec.ts tests/acceptance/nested-schema.spec.ts tests/acceptance/schema-versions.spec.ts
pnpm run typecheck
```

**Final local checks before PR:**

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

**Stop condition:** Phase 2 acceptance traceability points to automated coverage and GitHub CI is green.

## Deferred Work

Do not include these in Phase 2 micro-tasks:

- Mock data generation jobs.
- Faker or LLM value generation.
- Generated record preview table.
- Public mock runtime routes.
- API token management.
- CORS, rate limiting, and public CRUD.
- Phase 1 visual polish unless the user explicitly requests it as a separate PR.
