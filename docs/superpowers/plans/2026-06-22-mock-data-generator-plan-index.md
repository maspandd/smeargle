# Mock Data Generator Implementation Plan Set

**Design:** `docs/superpowers/specs/2026-06-22-mock-data-generator-design.md`  
**Traceability:** `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

Implement the platform in order. Each phase ends in deployable, testable software and has its own release gate.

1. `2026-06-22-phase-1-foundation-collaboration.md`
2. `2026-06-22-phase-2-schema-versioning.md`
3. `2026-06-22-phase-3-data-generation.md`
4. `2026-06-22-phase-4-mock-runtime.md`
5. `2026-06-22-phase-5-release-hardening.md`

## Locked Repository Structure

```text
prisma/                       Database schema and migrations
src/app/                      Next.js App Router pages and route handlers
src/features/auth/            Accounts, sessions, password policy
src/features/projects/        Projects, membership, authorization
src/features/schema/          Recursive field model, constraints, compatibility
src/features/versions/        Snapshots, diffs, rollback, downloads
src/features/generation/      Seeded generators, jobs, LLM provider interface
src/features/records/         Record persistence and preview
src/features/mock-runtime/    Public CRUD routes, tokens, CORS, rate limits
src/features/audit/           Append-only audit events and audit UI
src/lib/                      Shared database, errors, HTTP, logging, crypto
tests/acceptance/              Playwright acceptance scenarios
tests/integration/             Cross-feature and database integration tests
```

## TDD Rule

Every behavior step follows this sequence:

1. Add one focused test.
2. Run it and observe the expected failure.
3. Add the minimum production behavior.
4. Run the focused test and affected suite.
5. Refactor only while green.
6. Commit the coherent increment.

Configuration-only bootstrap steps are the approved exception; the first behavior after bootstrap must begin with a failing test.

