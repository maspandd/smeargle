# Phase 2 Schema and Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver recursive schema editing, all configured constraints, immutable version history, comparison, downloads, and rollback with precise data-compatibility behavior.

**Architecture:** Represent the current schema exclusively as the latest immutable `SchemaVersion.snapshot` JSON document. Parse every snapshot into a discriminated recursive domain model before use; all mutations produce a new snapshot and audit event in one transaction.

**Tech Stack:** TypeScript discriminated unions, Zod recursive schemas, Prisma/PostgreSQL JSONB, Vitest property and integration tests, Testing Library, Playwright

---

### Task 1: Define the recursive schema domain

**Files:**
- Create: `src/features/schema/schema-types.ts`
- Create: `src/features/schema/schema-parser.ts`
- Create: `src/features/schema/schema-parser.test.ts`
- Create: `src/features/schema/field-id.ts`

- [ ] **Step 1: Write the failing parser tests**

Test a valid String, constrained Number, Object with nested fields, and Array of Object. Test failures for duplicate sibling names, depth six, more than 100 direct fields, mixed arrays, invalid min/max, and obsolete constraints on a changed type.

Use this desired API:

```ts
const result = parseSchema({
  fields: [{
    id: "fld_address",
    name: "address",
    type: "object",
    required: true,
    fields: [{ id: "fld_city", name: "city", type: "string", required: true, minLength: 2, maxLength: 80 }],
  }],
});
expect(result.fields[0].type).toBe("object");
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/schema/schema-parser.test.ts`

Expected: FAIL because the schema domain does not exist.

- [ ] **Step 3: Implement discriminated types and recursive parsing**

Define `StringField`, `NumberField`, `BooleanField`, `DateField`, `SemanticField`, `ObjectField`, and `ArrayField`. Export `FieldDefinition`, `SchemaSnapshot`, and `parseSchema(input): SchemaSnapshot`.

Parse recursively with explicit `(depth,path)` context so errors contain paths such as `address.postal_code`. Enforce five levels and 100 direct fields after Zod structural validation.

- [ ] **Step 4: Add stable field IDs**

Implement `createFieldId()` using collision-resistant random bytes. IDs survive rename and reorder; imports preserve valid unique IDs or assign new IDs.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
pnpm vitest run src/features/schema/schema-parser.test.ts
pnpm typecheck
git add src/features/schema
git commit -m "feat: define recursive schema domain"
```

### Task 2: Add immutable schema versions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_schema_versions/migration.sql`
- Create: `src/features/versions/version-service.ts`
- Create: `src/features/versions/version-service.test.ts`

- [ ] **Step 1: Write the failing v1.0 persistence test**

Create a project and assert it has exactly one immutable v1.0 empty snapshot and `currentSchemaVersionId` points to it.

```ts
expect(project.currentSchemaVersion.versionLabel).toBe("v1.0");
expect(project.currentSchemaVersion.snapshot).toEqual({ fields: [] });
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/versions/version-service.test.ts`

Expected: FAIL because `SchemaVersion` and the project relation do not exist.

- [ ] **Step 3: Add the version model and migrate existing projects**

Add `SchemaVersion` with unique `(projectId,major,minor)`, JSON snapshot, change summary, actor, restored-from relation, and timestamp. Write a data migration that creates v1.0 `{fields:[]}` for every existing project before making `currentSchemaVersionId` required.

- [ ] **Step 4: Prevent application-level mutation**

Expose reads and create-only version operations through `version-service.ts`; do not export a general update method. Add a test proving schema mutations create a second row rather than updating v1.0.

- [ ] **Step 5: Verify migration and commit**

```powershell
pnpm prisma migrate dev --name schema_versions
pnpm vitest run src/features/versions/version-service.test.ts src/features/projects/project-service.test.ts
git add prisma src/features/versions src/features/projects
git commit -m "feat: persist immutable schema versions"
```

### Task 3: Implement add, edit, reorder, and delete mutations

**Files:**
- Create: `src/features/schema/schema-mutations.ts`
- Create: `src/features/schema/schema-mutations.test.ts`
- Create: `src/features/schema/schema-service.ts`
- Create: `tests/integration/schema-transaction.test.ts`

- [ ] **Step 1: Write failing pure mutation tests**

Test `addField`, `editField`, `reorderField`, and `deleteField` against nested paths. Assert duplicate sibling names fail, a String-to-Boolean change removes length constraints, and editing one nested field preserves all stable IDs and order.

Desired calls:

```ts
const next = editField(snapshot, ["fld_status"], {
  id: "fld_status",
  name: "status",
  type: "boolean",
  required: true,
});
expect(next.fields[0]).toEqual({ id: "fld_status", name: "status", type: "boolean", required: true });
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/schema/schema-mutations.test.ts`

Expected: FAIL because the mutation functions do not exist.

- [ ] **Step 3: Implement minimum immutable mutations**

Return new snapshots without mutating inputs. Locate fields by stable ID path, parse the final result with `parseSchema`, and return typed `NotFound`, `DuplicateFieldName`, or `InvalidConstraint` errors.

- [ ] **Step 4: Write the failing transactional service test**

Call `mutateSchema({actorId,projectId,expectedVersionId,mutation})` and assert one new version, the current pointer update, exact change summary, and one audit event. Add a stale expected version test returning `VERSION_CONFLICT` with no new rows.

- [ ] **Step 5: Implement the transaction and authorization**

Require `edit_schema`, read the current version inside the transaction, compare IDs, apply the pure mutation, create `minor+1`, update the project pointer, and append the audit event.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/features/schema tests/integration/schema-transaction.test.ts
git add src/features/schema tests/integration
git commit -m "feat: mutate schemas transactionally"
```

### Task 4: Classify and apply record compatibility changes

**Files:**
- Create: `src/features/schema/compatibility.ts`
- Create: `src/features/schema/compatibility.test.ts`
- Create: `src/features/records/record-transform.ts`
- Create: `src/features/records/record-transform.test.ts`
- Modify: `src/features/schema/schema-service.ts`

- [ ] **Step 1: Write failing compatibility table tests**

Assert optional add and widened constraints are compatible; field deletion and rename are transformable with confirmation; required add, narrowed constraints, type change, and incompatible rollback require regeneration.

```ts
expect(classifySchemaChange(before, after)).toEqual({
  kind: "TRANSFORMABLE",
  affectedFieldIds: ["fld_description"],
  operation: "DELETE_KEYS",
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/schema/compatibility.test.ts`

Expected: FAIL because `classifySchemaChange` is missing.

- [ ] **Step 3: Implement recursive classification**

Compare by stable field ID, not name. Recurse into objects and array item schemas. Return `COMPATIBLE`, `TRANSFORMABLE`, or `INCOMPATIBLE` plus affected field paths and a user-facing warning.

- [ ] **Step 4: Write and implement record transformations test-first**

Test deleting nested keys from ten JSON records and renaming a key without changing other content. Implement pure transformations, then apply them in the same schema transaction only after `confirmedImpact=true`.

- [ ] **Step 5: Mark unresolved datasets incompatible**

Add `dataStatus` to Project with `EMPTY`, `COMPATIBLE`, and `INCOMPATIBLE`. An incompatible mutation preserves records, marks the project, and stores affected paths in the audit metadata.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/features/schema src/features/records tests/integration/schema-transaction.test.ts
git add src/features prisma tests/integration
git commit -m "feat: classify schema data compatibility"
```

### Task 5: Build the recursive Schema Builder UI

**Files:**
- Create: `src/app/(app)/projects/[projectId]/schema/page.tsx`
- Create: `src/features/schema/components/schema-builder.tsx`
- Create: `src/features/schema/components/field-card.tsx`
- Create: `src/features/schema/components/field-dialog.tsx`
- Create: `src/features/schema/components/nested-fields-editor.tsx`
- Create: `src/features/schema/components/field-dialog.test.tsx`
- Create: `src/app/(app)/projects/[projectId]/schema/actions.ts`

- [ ] **Step 1: Write failing conditional-form tests**

Select String and assert Min/Max Length appear; Number shows Min/Max/Decimal Places; Date shows Start/End; Array shows Item Type and Min/Max Items; Object shows Add Nested Field. Assert switching types removes obsolete controls and values.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/schema/components/field-dialog.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible recursive editor**

Use fieldsets and legends for nested scopes, labelled controls, `aria-describedby` errors, predictable focus after add/delete, and a depth indicator. Prevent adding past level five or 100 direct fields before submission; repeat checks server-side.

- [ ] **Step 4: Add cards, expansion, and confirmation flows**

Cards show normalized constraint summaries and the blue semantic badge. Object expansion lists nested names/types. Delete warnings distinguish unused fields from fields present in N records. Server Action responses include `expectedVersionId` and render 409 refresh guidance.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/schema/components
pnpm typecheck
pnpm lint
git add src/features/schema/components src/app/(app)/projects/[projectId]/schema
git commit -m "feat: add recursive schema builder"
```

### Task 6: Generate recursive version diffs and history

**Files:**
- Create: `src/features/versions/schema-diff.ts`
- Create: `src/features/versions/schema-diff.test.ts`
- Create: `src/features/versions/version-query.ts`
- Create: `src/features/versions/components/version-history.tsx`
- Create: `src/features/versions/components/version-comparison.tsx`
- Create: `src/app/(app)/projects/[projectId]/versions/page.tsx`

- [ ] **Step 1: Write the failing recursive diff tests**

Given v1.2 and v1.4 snapshots, assert added, deleted, renamed, reordered, constraint-modified, and nested changes are identified by stable ID and summarized with exact counts.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/versions/schema-diff.test.ts`

Expected: FAIL because `diffSchemas` does not exist.

- [ ] **Step 3: Implement deterministic diff output**

Return sorted `SchemaChange[]` entries with `kind`, `fieldId`, `pathBefore`, `pathAfter`, `before`, and `after`. Keep reorder separate from modification so comparison counts remain meaningful.

- [ ] **Step 4: Build history and comparison views**

Query all versions newest first with actor and status. Render side-by-side snapshots with green added, red deleted, and yellow modified states plus a text/icon label so color is not the only signal.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/features/versions
pnpm typecheck
pnpm lint
git add src/features/versions src/app/(app)/projects/[projectId]/versions
git commit -m "feat: compare schema versions"
```

### Task 7: Implement rollback and JSON download

**Files:**
- Create: `src/features/versions/rollback-service.ts`
- Create: `src/features/versions/rollback-service.test.ts`
- Create: `src/app/(app)/projects/[projectId]/versions/actions.ts`
- Create: `src/app/api/projects/[projectId]/versions/[versionId]/download/route.ts`
- Create: `tests/integration/schema-download.test.ts`

- [ ] **Step 1: Write failing rollback tests**

Rollback from v1.4 to v1.2 and assert a new v1.5 snapshot equal to v1.2, `restoredFromId` references v1.2, later history remains, and incompatible data is flagged. Assert Cancel causes no service call in the component test.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/versions/rollback-service.test.ts`

Expected: FAIL because rollback is missing.

- [ ] **Step 3: Implement rollback through the schema transaction**

Require `edit_schema`, expected current version, and `confirmedImpact`. Reuse compatibility classification and the version transaction; never update or delete historical snapshots.

- [ ] **Step 4: Write the failing download route test**

Assert Viewer access returns 200 JSON, complete selected snapshot, `Content-Disposition: attachment`, and sanitized filename `e-commerce-products-api-schema-v1.3.json`; non-member returns 403.

- [ ] **Step 5: Implement download and verify GREEN**

Return a stable export envelope containing product/schema format versions, project metadata, version metadata, and snapshot. Run rollback and download tests until green.

- [ ] **Step 6: Commit**

```powershell
git add src/features/versions src/app tests/integration
git commit -m "feat: rollback and export schema versions"
```

### Task 8: Prove Phase 2 acceptance criteria

**Files:**
- Create: `tests/acceptance/schema-fields.spec.ts`
- Create: `tests/acceptance/schema-constraints.spec.ts`
- Create: `tests/acceptance/nested-schema.spec.ts`
- Create: `tests/acceptance/schema-versions.spec.ts`
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

- [ ] **Step 1: Write failing acceptance scenarios**

Cover AC-02.01-02.04, AC-05.01-05.04, AC-06.01-06.03, AC-07.01-07.03, AC-08.01, AC-08.03-08.04, and AC-09.01-09.10. Include Viewer rejection and stale-version conflict.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm test:e2e --grep "Phase 2"`

Expected: one or more scenarios fail for a missing behavior, not fixture or selector setup.

- [ ] **Step 3: Apply only acceptance-driven fixes**

Correct production behavior and accessible labels; do not add timing sleeps or weaken exact version/change assertions.

- [ ] **Step 4: Run the Phase 2 release gate**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e --grep "Phase 1|Phase 2"
pnpm build
```

Expected: all commands pass and historical Phase 1 flows remain green.

- [ ] **Step 5: Update traceability and commit**

```powershell
git add tests/acceptance docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md
git commit -m "test: verify schema and version acceptance"
```

