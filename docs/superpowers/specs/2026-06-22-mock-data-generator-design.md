# Mock Data Generator Full-Platform Design

**Status:** Approved design, pending written-spec review  
**Product:** PRD-002 Mock Data Generator  
**Date:** 2026-06-22  
**Audience:** Product, engineering, QA, security, and operations

## 1. Purpose

Build a multi-user internal web platform that lets frontend teams define versioned API schemas, generate reproducible Indonesian mock data, and expose that data through realistic HTTP endpoints before backend services exist.

The platform must reduce frontend/backend blocking, replace scattered hard-coded fixtures, make schema changes traceable, and provide stable contracts for development and automated testing.

## 2. Source Analysis

The supplied brief contains nine user stories and 47 acceptance criteria. It describes four substantial subsystems:

1. Project collaboration and access control.
2. Recursive schema design and version management.
3. Data generation and preview.
4. Public mock API runtime.

The original criteria provide strong UI examples but leave several system behaviors ambiguous or contradictory. This design normalizes them as follows:

| Original ambiguity or gap | Design decision |
|---|---|
| The product overview promises CRUD, but US-04 specifies only GET and POST. | Support collection GET/POST and record GET/PUT/PATCH/DELETE. |
| The persona is a frontend developer, but the selected operating model is multi-user. | Add system administration and per-project Owner, Editor, and Viewer roles. |
| "LLM-powered" data types do not define cost, failure, or reproducibility behavior. | Use seeded Indonesian faker output by default; optionally enrich semantic fields through an LLM provider with faker fallback. |
| Null generation says only "several cells" are null. | Store a configurable null percentage; exclude required identifier fields. |
| Auto-versioning does not define concurrent edit behavior. | Require an expected version on mutations and reject stale writes with `409 VERSION_CONFLICT`. |
| Version labels use `v1.x` but do not define breaking changes. | Start at v1.0 and increment the minor version for each successful schema mutation; no semantic breaking-change inference in v1. |
| Rollback could imply rewriting history. | Restore an old snapshot as a new version and preserve all history. |
| Deleting or changing fields can invalidate records. | Classify compatibility, transform data only when unambiguous, and mark unresolved datasets incompatible. |
| Project IDs appear directly in public URLs. | Use a stable, non-sequential route key and optional bearer token rather than an internal database ID. |
| Data dates and names imply mixed locales. | First release generates Indonesian (`id-ID`) data only. |
| Record limits, nesting depth, and field counts are unspecified. | Limit nesting to five levels, fields to 100 per object, arrays to one item type, and generation jobs to 10,000 records. |
| Endpoint validation only checks a leading slash. | Require a normalized path beginning with `/`, disallow query strings/fragments, and reserve platform paths. |

Language and encoding errors in the original English document are editorial, not behavioral. The traceability matrix uses the original AC identifiers while applying the normalized wording in this specification.

## 3. Scope

### 3.1 Included

- Email/password accounts and secure sessions.
- System administrator capability for account administration.
- Project membership with Owner, Editor, and Viewer roles.
- Project dashboard, creation, settings, and membership management.
- Recursive schema fields: String, Number, Boolean, Date, Object, Array, Email, Person Name, Product Name, and Address.
- Type-specific constraints and validation.
- Field creation, editing, deletion, reordering, expansion, and import/export.
- Immutable schema history, comparison, download, and rollback.
- Seeded Indonesian faker generation and optional LLM enrichment.
- Bulk generation, null policy, replacement confirmation, job progress, and preview.
- Public collection and record CRUD endpoints.
- Optional bearer tokens, CORS allowlists, rate limiting, and API usage examples.
- Audit events, structured logging, health checks, and operational metrics.
- Responsive, keyboard-accessible user interface.

### 3.2 Not Included in the First Release

- Company SSO, social login, or external customer tenancy.
- Locales other than Indonesian.
- GraphQL, SOAP, WebSocket, or event-stream mocks.
- Conditional response scripting, latency/failure simulation, or scenario engines.
- Mixed-type arrays or schemas deeper than five levels.
- Automatic OpenAPI import or generation.
- Billing, quotas by subscription, or public self-registration.
- Semantic major/minor/patch version inference.

## 4. Architecture

Use a modular monolith deployed as one Next.js and TypeScript application backed by PostgreSQL. Keep modules isolated by domain interfaces so the public runtime or generation worker can be extracted after measured load justifies it.

### 4.1 Modules

| Module | Responsibility | Dependencies |
|---|---|---|
| Identity and Access | Accounts, password verification, sessions, system role, project authorization | PostgreSQL, secure cookie/session library |
| Projects | Project settings, route key, locale, endpoint, membership | Identity and Access, PostgreSQL |
| Schemas | Recursive field definitions, constraints, mutations, compatibility classification | Projects, Versions |
| Versions | Immutable snapshots, version numbering, diffs, rollback-as-new-version, downloads | Schemas, Audit |
| Generation | Seeded faker generation, LLM enrichment, null policy, durable job lifecycle | Schemas, Records, queue adapter |
| Records | JSON payload storage, schema-version association, preview queries, compatibility status | Projects, Schemas |
| Mock Runtime | Public CRUD, validation, pagination, sorting, filters, tokens, CORS, rate limiting | Records, Schemas, Credentials |
| Audit and Operations | Append-only audit events, structured logs, health and performance metrics | All mutation modules |

### 4.2 Trust Zones

- The authenticated application uses secure browser sessions and CSRF protection.
- The public mock runtime does not trust dashboard sessions. It resolves projects by route key and, when enabled, validates a bearer token.
- Generation executes asynchronously through a database-backed queue. A later queue replacement must remain behind the same job interface.
- The LLM adapter receives only synthetic context and schema metadata. It never receives credentials, membership data, audit data, or existing confidential content.

### 4.3 Transaction Boundaries

Each schema mutation writes the new schema snapshot, increments the version, performs any approved record transformation, and appends an audit event in one database transaction. Failure rolls back all four effects.

Generation writes to a staging job result and atomically replaces the current project dataset only after the job succeeds. A failed or cancelled job leaves the previous dataset unchanged.

## 5. Domain Model

### 5.1 Primary Entities

| Entity | Important fields |
|---|---|
| User | id, email, passwordHash, systemRole, status, createdAt, updatedAt |
| Session | id, userId, expiresAt, revokedAt |
| Project | id, name, baseEndpoint, routeKey, locale, currentSchemaVersionId, dataStatus, createdAt |
| ProjectMembership | projectId, userId, role, invitedBy, createdAt |
| SchemaVersion | id, projectId, major, minor, snapshotJson, changeSummary, actorId, restoredFromId, createdAt |
| MockRecord | id, projectId, schemaVersionId, payloadJson, source, createdAt, updatedAt |
| GenerationJob | id, projectId, schemaVersionId, count, seed, nullRate, llmPolicy, status, warningSummary, error, timestamps |
| ApiCredential | id, projectId, label, tokenHash, lastUsedAt, expiresAt, revokedAt |
| LlmConfiguration | projectId, provider, model, encryptedSecretReference, enabled |
| AuditEvent | id, actorId, projectId, action, targetType, targetId, metadataJson, createdAt |

### 5.2 Schema Snapshot

A schema snapshot stores an ordered list of fields. Every field contains:

- Stable field ID and a sibling-unique name.
- Data type and required/nullability configuration.
- Type-specific constraints.
- For Object, an ordered nested field list.
- For Array, one scalar or object item definition plus minimum and maximum item counts.

Field names are unique only within the immediate containing object. Nested depth cannot exceed five levels, and each object cannot exceed 100 direct fields.

### 5.3 Constraints

- String: minimum and maximum length, optional supported format.
- Number: minimum and maximum value, zero to six decimal places.
- Date: inclusive start and end date using an unambiguous stored ISO date.
- Array: minimum and maximum items and one item schema.
- Semantic types: Email, Person Name, Product Name, and Address, generated using Indonesian data rules.
- All min/max pairs require minimum less than or equal to maximum.

### 5.4 Invariants

- Every project has at least one Owner.
- Passwords and API tokens are never stored in plaintext.
- Schema snapshots and audit events are immutable.
- Every mock record references the schema version used to validate or generate it.
- Route keys are globally unique, stable, and non-sequential.
- Generation jobs are idempotent by job ID.

## 6. Authorization

| Capability | Owner | Editor | Viewer | System Admin |
|---|---:|---:|---:|---:|
| View project, schema, data, versions | Yes | Yes | Yes | Yes |
| Generate and mutate mock records | Yes | Yes | No | Yes |
| Add, edit, delete, import, or rollback schema | Yes | Yes | No | Yes |
| Manage API credentials and CORS | Yes | Yes | No | Yes |
| Manage project members and settings | Yes | No | No | Yes |
| Delete project or transfer ownership | Yes | No | No | Yes |
| Administer user accounts | No | No | No | Yes |

The server verifies authorization on every mutation. Disabled or hidden controls are only a usability aid and never the enforcement boundary.

## 7. User Experience

### 7.1 Navigation

The global navigation contains Dashboard, Admin for system administrators, and Account. A project workspace contains Schema Builder, Generate and Data, Mock API, Versions, Members, and Settings.

The workspace header displays project name, base endpoint, Indonesian locale, member count, data compatibility, and current version badge.

### 7.2 Project Creation

Creation requires a nonblank project name and normalized base endpoint beginning with `/`. Success creates the project at v1.0, adds the creator as Owner, closes the modal, displays one success notification, and opens the empty Schema Builder.

Cancel, close, and overlay dismissal create no project and display no notification.

### 7.3 Schema Builder

- Field cards show name, type, concise constraints, semantic-type badge, and edit/delete controls.
- Object cards and object cells expand to reveal nested fields or JSON.
- The add/edit modal changes constraint controls based on selected type.
- Changing type clears constraints that do not apply to the new type.
- Drag-and-drop changes field order only.
- Duplicate names remain invalid within the same object scope.
- Successful mutations close the modal, create one version, and display one consolidated schema-version notification.

### 7.4 Generation and Preview

The generation form accepts record count, optional seed, null percentage, and faker-only or hybrid LLM policy. A blank seed causes the server to create and display a seed so the result can be reproduced.

Generation is blocked for an empty schema. If records already exist, confirmation names the exact count being replaced. The old dataset remains active until the new job completes successfully.

Preview uses server pagination. Scalar fields render directly; null values use accessible text and muted styling; objects and arrays expand as formatted JSON. The header reports the displayed and total record counts.

### 7.5 Versions

Projects start at v1.0. Every successful add, edit, delete, reorder, import, or rollback increments the minor version. Version history shows actor, timestamp, change summary, and current/previous status.

Comparison recursively classifies added, deleted, and modified fields. Rollback restores the selected snapshot as a new current version and records `restoredFromId`; it never removes later versions.

Schema downloads use a sanitized project slug and version, for example `e-commerce-products-api-schema-v1.3.json`.

## 8. Generation Behavior

### 8.1 Deterministic Base Generation

The base generator uses an explicit seed and Indonesian providers. All constraints are inclusive. Number decimal precision, string lengths, date ranges, array lengths, object nesting, and required/null rules must be satisfied for every generated record.

When nulls are enabled, the user chooses a percentage. Required identifier fields are never nulled.

### 8.2 Hybrid LLM Enrichment

Hybrid mode applies only to semantic fields marked for enrichment. The provider interface accepts a typed batch request and returns values mapped to record and field IDs.

The job uses bounded batches, timeout, retry, and quota handling. Missing, invalid, or failed LLM values fall back to deterministic faker values. Completion reports how many values used fallback. CI and local tests use a fake provider and never call a paid service.

## 9. Public Mock API

### 9.1 Routes

- `GET /api/mock/{routeKey}/{resource}`
- `POST /api/mock/{routeKey}/{resource}`
- `GET /api/mock/{routeKey}/{resource}/{recordId}`
- `PUT /api/mock/{routeKey}/{resource}/{recordId}`
- `PATCH /api/mock/{routeKey}/{resource}/{recordId}`
- `DELETE /api/mock/{routeKey}/{resource}/{recordId}`

`resource` is derived from the normalized project base endpoint. Project settings show the exact usable URL rather than requiring users to derive it.

### 9.2 Collection Reads

Collection GET supports bounded page/pageSize pagination, stable sorting by an allowed field, and exact-match filters for scalar fields. The default response remains compatible with the supplied criteria:

```json
{
  "data": [],
  "meta": {
    "count": 0,
    "endpoint": "/api/users",
    "projectId": "xyz789"
  }
}
```

Additional pagination metadata may be included without removing these fields.

### 9.3 Writes

POST, PUT, and PATCH validate JSON against the current schema. POST generates a collision-resistant record ID if the payload does not contain an identifier. PUT replaces the payload; PATCH validates the merged payload. DELETE returns 204 after removal.

Public writes are blocked while the dataset is incompatible with the current schema.

### 9.4 Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body does not match the current schema",
    "details": [{ "path": "price", "message": "Expected number" }],
    "requestId": "req_example"
  }
}
```

Use 400 for malformed input, 401 for a missing or invalid required token, 403 for a disabled method, 404 for a missing project/resource/record, 409 for a version or identifier conflict, 422 for schema validation, 429 for rate limiting, and 500 for unexpected failures. JSON routes always return JSON errors and `Content-Type: application/json`.

## 10. Compatibility Rules

- Adding an optional field or widening a constraint preserves compatibility.
- Deleting a field can atomically remove it from existing records after explicit confirmation.
- Renaming a field requires an explicit record-key migration confirmation.
- Type changes, required additions, narrowed constraints, or incompatible rollbacks mark data incompatible unless every record can be transformed without guessing.
- Incompatible data remains readable in the authenticated preview but public writes are blocked until regeneration or explicit deletion.

## 11. Security and Reliability

- Use Argon2id password hashing, secure HTTP-only cookies, session expiry/revocation, CSRF protection, and login rate limiting.
- Store only hashes of API tokens; show plaintext once on creation.
- Support per-project CORS allowlists and per-route-key rate limiting.
- Encrypt provider secrets at rest and redact secrets from errors, logs, and audit metadata.
- Reject stale schema edits using the expected current version.
- Retry transient generation failures with bounded backoff. LLM failure falls back to faker; database failure fails the job without replacing data.
- Emit structured logs with request, actor, project, schema version, and job identifiers.
- Expose application, database, queue, and optional provider health signals.

## 12. Testing Strategy

Every production behavior follows Red-Green-Refactor:

1. Write one minimal failing test.
2. Run it and verify it fails for the missing behavior.
3. Implement the smallest passing change.
4. Run focused and affected suites.
5. Refactor only while green and commit the coherent increment.

### 12.1 Layers

- Domain tests: constraints, recursive schemas, diffs, compatibility, version increments, generators.
- Database integration tests: transactions, authorization queries, immutable snapshots, jobs, audit events.
- Route integration tests: authentication, permissions, status codes, envelopes, CRUD, pagination, filters.
- Component tests: conditional forms, recursive editing, previews, confirmations, accessible states.
- Browser acceptance tests: primary happy path and critical rejection paths for each AC group.

Tests freeze time and use explicit random seeds. Database tests use isolated schemas or disposable databases. Parallel tests use unique users, projects, route keys, and jobs. LLM tests use a local fake provider.

### 12.2 Release Gates

- Type checking, linting, unit, integration, and browser suites pass.
- The AC traceability matrix contains no uncovered criterion.
- Changed flows pass keyboard navigation and automated accessibility checks.
- Migrations upgrade and roll back in a disposable environment.
- No unresolved critical or high security findings.
- Authenticated read p95 is below 300 ms at expected internal load.
- Public mock GET p95 is below 200 ms for a 100-record page.
- A 1,000-record faker job completes within 10 seconds in the reference environment.

## 13. Delivery Phases

1. **Foundation and collaboration:** application foundation, accounts, sessions, roles, dashboard, projects, membership, US-01.
2. **Schema and versions:** recursive schema, constraints, edit/delete, version history, comparison, rollback, US-02 and US-05 through US-09.
3. **Generation:** seeded Indonesian generator, nulls, preview, replacement, jobs, hybrid LLM fallback, US-03 and generation-related ACs.
4. **Mock runtime:** public full CRUD, validation, tokens, CORS, rate limiting, API documentation, US-04 expanded to the agreed CRUD scope.
5. **Release hardening:** import/export, audit UI, administration, accessibility, performance, security, and operations.

Each phase receives a separate TDD implementation plan and must produce deployable, testable software.

## 14. Success Measures

- Median time from project creation to a usable mock GET endpoint.
- Weekly active projects and generated datasets.
- Percentage of generation jobs reproducible from a saved seed.
- Public API request success and validation-failure rates.
- Schema mismatch incidents discovered before backend integration.
- Developer-reported time saved, measured against the stated 5-10 hour weekly target.

The claimed 30-40% delivery improvement and 60% mismatch reduction are targets, not guaranteed outcomes. Establish a baseline before rollout and review these measures after each phase.
