# Mock Data Generator Acceptance-Criteria Traceability

**Source:** PRD-002 supplied user stories and acceptance criteria  
**Design:** `docs/superpowers/specs/2026-06-22-mock-data-generator-design.md`

## Coverage Matrix

| AC | Normalized behavior | Phase | Primary automated coverage |
|---|---|---:|---|
| AC-01.01 | Create a valid project at v1.0 and redirect to its empty schema workspace | 1 | `tests/acceptance/project-creation.spec.ts`, `src/features/projects/project-service.test.ts` |
| AC-01.02 | Reject a blank project name without closing the modal | 1 | `tests/acceptance/project-creation.spec.ts`, `src/features/projects/components/create-project-dialog.test.tsx` |
| AC-01.03 | Reject an endpoint without a leading slash | 1 | `tests/acceptance/project-creation.spec.ts`, `src/features/projects/project-service.test.ts` |
| AC-01.04 | Cancel or dismiss creation without persistence or notification | 1 | `tests/acceptance/project-creation.spec.ts`, `src/features/projects/components/create-project-dialog.test.tsx` |
| AC-02.01 | Add a constrained String field | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/components/schema-builder.test.tsx`, `tests/acceptance/schema-fields.spec.ts` |
| AC-02.02 | Add an Email semantic field with its badge | 2 | `src/features/schema/components/schema-builder.test.tsx`, `tests/acceptance/schema-fields.spec.ts`, `tests/acceptance/schema-builder.spec.ts` |
| AC-02.03 | Reject a duplicate sibling field name | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/schema-mutations.test.ts`, `tests/integration/schema-transaction.test.ts`, `tests/acceptance/schema-fields.spec.ts` |
| AC-02.04 | Add a constrained Number field | 2 | `src/features/schema/schema-parser.test.ts`, `tests/acceptance/schema-fields.spec.ts`, `tests/acceptance/schema-constraints.spec.ts` |
| AC-03.01 | Generate ten complete non-null records and preview them | 3 | `tests/acceptance/data-generation.spec.ts`, `tests/integration/generation-job.test.ts` |
| AC-03.02 | Generate records using the configured null policy and render null accessibly | 3 | `tests/acceptance/data-generation.spec.ts`, `src/features/records/components/data-preview.test.tsx` |
| AC-03.03 | Reject a missing record count | 3 | `tests/acceptance/data-generation.spec.ts`, `src/features/generation/components/generation-form.test.tsx` |
| AC-03.04 | Reject generation for an empty schema | 3 | `tests/acceptance/data-generation.spec.ts` |
| AC-03.05 | Ask before replacing an existing dataset | 3 | `tests/acceptance/data-generation.spec.ts`, `src/features/generation/components/generation-form.test.tsx` |
| AC-03.06 | Atomically replace records after confirmation | 3 | `tests/acceptance/data-generation.spec.ts`, `tests/integration/generation-job.test.ts` |
| AC-04.01 | GET returns generated records, metadata, JSON content type, and 200 | 4 | Route integration + acceptance HTTP |
| AC-04.02 | GET returns an empty data array when no records exist | 4 | Route integration |
| AC-04.03 | POST validates, creates an ID, returns 201, and appears in later GET | 4 | Route integration + acceptance HTTP |
| AC-04.04 | Unknown route key returns JSON 404 | 4 | Route integration |
| AC-05.01 | Persist and display String length constraints | 2 | `src/features/schema/schema-parser.test.ts`, `tests/acceptance/schema-constraints.spec.ts` |
| AC-05.02 | Persist and display Number range and precision | 2 | `src/features/schema/schema-parser.test.ts`, `tests/acceptance/schema-constraints.spec.ts` |
| AC-05.03 | Persist and display an inclusive Date range | 2 | `src/features/schema/schema-parser.test.ts`, `tests/acceptance/schema-constraints.spec.ts` |
| AC-05.04 | Reject maximum Number value below minimum | 2 | `src/features/schema/schema-parser.test.ts`, `tests/acceptance/schema-constraints.spec.ts` |
| AC-05.05 | Generated strings always satisfy configured lengths | 3 | `src/features/generation/scalar-generator.test.ts` |
| AC-05.06 | Generated numbers always satisfy range and decimal precision | 3 | `src/features/generation/scalar-generator.test.ts` |
| AC-05.07 | Generated dates always satisfy the inclusive range | 3 | `src/features/generation/scalar-generator.test.ts` |
| AC-06.01 | Confirm and delete an unused field | 2 | `src/features/schema/schema-mutations.test.ts`, `src/features/schema/schema-service.test.ts` |
| AC-06.02 | Cancel field deletion without mutation or notification | 2 | Pending browser coverage when field delete UI is introduced |
| AC-06.03 | Delete a used field and atomically remove it from records | 2 | `src/features/schema/schema-service.test.ts`, `src/features/records/record-transform.test.ts` |
| AC-07.01 | Edit Number constraints and create a new version | 2 | `src/features/schema/schema-mutations.test.ts`, `src/features/schema/schema-service.test.ts` |
| AC-07.02 | Change field type and clear obsolete constraints | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/schema-mutations.test.ts`, `src/features/schema/components/field-dialog.test.tsx` |
| AC-07.03 | Reject rename to an existing sibling name | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/schema-mutations.test.ts`, `tests/integration/schema-transaction.test.ts` |
| AC-08.01 | Add an Object with nested fields | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/components/nested-fields-editor.test.tsx`, `tests/acceptance/nested-schema.spec.ts` |
| AC-08.02 | Generate and preview nested object data | 3 | `tests/acceptance/nested-data-preview.spec.ts` |
| AC-08.03 | Add a constrained Array item schema | 2 | `src/features/schema/schema-parser.test.ts`, `src/features/schema/components/nested-fields-editor.test.tsx`, `tests/acceptance/nested-schema.spec.ts` |
| AC-08.04 | Expand an Object field card to show nested fields | 2 | `src/features/schema/components/nested-fields-editor.test.tsx`, `tests/acceptance/nested-schema.spec.ts` |
| AC-08.05 | Expand a preview cell to show formatted nested JSON | 3 | `tests/acceptance/nested-data-preview.spec.ts`, `src/features/records/components/data-preview.test.tsx` |
| AC-08.06 | Generated arrays always satisfy item type and length bounds | 3 | `src/features/generation/record-generator.test.ts` |
| AC-09.01 | Schema mutation automatically increments and displays the version | 2 | `src/features/versions/version-service.test.ts`, `src/features/schema/schema-service.test.ts`, `tests/acceptance/schema-fields.spec.ts`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.02 | Show complete version history and status | 2 | `src/features/versions/components/version-history.test.tsx`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.03 | Show version metadata, changes, and snapshot | 2 | `src/features/versions/version-query.ts`, `src/features/versions/components/version-history.test.tsx`, `src/features/versions/components/version-comparison.test.tsx`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.04 | Recursively compare two versions and summarize changes | 2 | `src/features/versions/schema-diff.test.ts`, `src/features/versions/components/version-comparison.test.tsx`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.05 | Roll back as a new version and flag incompatible data | 2 | `src/features/versions/rollback-service.test.ts`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.06 | Cancel rollback without mutation | 2 | `src/features/versions/components/version-history.test.tsx`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.07 | Editing a field creates a version with a precise change summary | 2 | `src/features/schema/schema-service.test.ts` |
| AC-09.08 | Deleting a field creates a version with a precise change summary | 2 | `src/features/schema/schema-service.test.ts` |
| AC-09.09 | Download a complete, correctly named schema JSON snapshot | 2 | `tests/integration/schema-download.test.ts`, `tests/acceptance/schema-versions.spec.ts` |
| AC-09.10 | Show each project's current version badge on the dashboard | 2 | `src/app/(app)/dashboard/dashboard-client.test.tsx`, `tests/acceptance/project-creation.spec.ts`, `tests/acceptance/schema-fields.spec.ts` |

## Added Acceptance Groups

The selected multi-user and full-CRUD scope requires criteria not present in the source document. The implementation plans must add executable scenarios for:

- Registration or admin-created account, login, logout, expiry, lockout, and password security.
- Owner, Editor, and Viewer permissions on every project mutation.
- Adding, changing, removing, and protecting the last project Owner.
- Record GET, PUT, PATCH, and DELETE.
- Token creation, one-time display, use, rotation, revocation, and expiry.
- CORS allowlists and route-key rate limiting.
- Seed reproducibility and hybrid LLM fallback reporting.
- Stale version conflict and atomic schema/version/audit transactions.
- Import/export validation and malformed schema rejection.
- Keyboard navigation, focus management, screen-reader labels, and accessible errors.
- Audit-event coverage for privileged and destructive actions.
- Health, performance, migration, and recovery release gates.

## Phase 1 Added-Criteria Evidence

| Behavior | Automated coverage |
|---|---|
| Login success and generic rejection | `tests/acceptance/authentication.spec.ts`, `src/features/auth/auth-service.test.ts` |
| Password hashing, session hashing, expiry, logout, and disabled accounts | `src/features/auth/auth-service.test.ts`, `src/app/(auth)/login/actions.test.ts` |
| Owner, Editor, Viewer, and system-administrator authorization | `tests/acceptance/project-membership.spec.ts`, `src/features/projects/authorization.test.ts`, `tests/integration/project-authorization.test.ts` |
| Add, change, remove, audit, and protect the final project Owner | `tests/acceptance/project-membership.spec.ts`, `src/features/projects/membership-service.test.ts` |
