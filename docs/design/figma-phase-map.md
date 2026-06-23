# Figma Phase And Task Map

**Figma source:** [MOCKDATA](https://www.figma.com/design/LB6eZhPo583NkdVxjbIIzA/MOCKDATA?node-id=71-252&p=f&t=Igpcud4b0lVTobNi-0)  
**Design reference:** `docs/design/figma-design.md`

This map keeps implementation small by tying each visible Figma screen to the approved implementation phases.

## Frame Map

| Figma frame | Node | App area | Phase | Primary task mapping | Notes |
|---|---:|---|---:|---|---|
| Project | `71:253` | Dashboard/project shell | 1 and visual polish | Existing Phase 1 surface | Use as visual refinement reference for current dashboard. |
| Schema empty state | `71:292` | Project workspace before fields | 2 | Phase 2 Task 5 | Same shell as schema builder, but no field rows yet. |
| Schema with fields | `71:339` | Recursive schema builder | 2 | Phase 2 Tasks 1, 3, 5, 8 | Main Phase 2 implementation reference. |
| Field action tooltip | `71:1608` | Field row menu | 2 | Phase 2 Tasks 3, 5 | Edit/delete overflow menu. |
| Field form/popup fragments | `71:1538` and nearby nodes | Add/edit field form | 2 | Phase 2 Tasks 3, 5 | Metadata shows field constraint inputs such as min/max length. |
| Mock data generation | `71:1917` | Generation form and preview | 3 | Phase 3 Tasks 6, 7, 8 | Main Phase 3 visual reference. |

## Phase 1 Follow-Up

Phase 1 is already implemented, but the Figma Project frame can guide visual cleanup:

- Replace the current dashboard shell with the Figma-style rounded header and content surfaces.
- Align project rail width, spacing, search input, and create action.
- Keep all existing Phase 1 permissions and project behavior unchanged.

Do this only as a small visual-polish PR if desired. It is not required before starting Phase 2.

## Phase 2 Design Breakdown

### Task 1: Recursive Schema Domain

Figma evidence:

- `Schema with fields` shows scalar fields and an expanded object field.
- The nested `address` object contains `street`, `city`, and `postal_code`.
- `customer_email` uses a semantic type badge.

Implementation guidance:

- Model recursive fields before building the UI.
- Support scalar, semantic, object, and array-capable shapes from the approved Phase 2 plan.
- Preserve sibling-name uniqueness because the UI presents fields as a sibling list.

### Task 2: Immutable Schema Versions

Figma evidence:

- Workspace header displays `v1.0` directly under the endpoint.

Implementation guidance:

- Keep version display visible near project metadata.
- Increment version after schema mutations.
- Later version history can use the same project workspace shell.

### Task 3: Add, Edit, Reorder, Delete Mutations

Figma evidence:

- `Add Field` action appears in the schema action bar.
- Each field row has an overflow menu.
- Tooltip frame contains edit/delete actions.

Implementation guidance:

- Start with add/edit/delete; defer drag/reorder visual polish until the behavior is proven.
- Use the overflow menu for row actions.
- Confirm destructive deletes as required by acceptance criteria.

### Task 4: Record Compatibility Changes

Figma evidence:

- Not directly shown, but schema mutations imply generated records may become stale.

Implementation guidance:

- Keep compatibility warnings near schema actions or mutation confirmations.
- Do not introduce the Phase 3 records table while implementing Phase 2 compatibility logic.

### Task 5: Recursive Schema Builder UI

Figma evidence:

- This is the primary Figma match for `Schema with fields`.

Implementation guidance:

- Build the project workspace around:
  - project rail
  - project header
  - action bar
  - recursive field list
- Use indentation and chevrons for object fields.
- Show semantic badges for LLM-powered or semantic fields.

### Task 6: Version Diffs And History

Figma evidence:

- No dedicated version-history frame was captured.

Implementation guidance:

- Follow the approved Phase 2 plan over Figma for history UI.
- Reuse the shell and table/list language from the schema builder.

### Task 7: Rollback And JSON Download

Figma evidence:

- No rollback or download frame was captured.

Implementation guidance:

- Follow the approved Phase 2 plan.
- Use button/link styling consistent with schema actions.

### Task 8: Prove Phase 2 Acceptance

Figma evidence:

- Schema builder with fields covers the visual assertions for:
  - adding scalar fields
  - semantic Email badge
  - nested object expansion
  - version badge
  - field row actions

Implementation guidance:

- Browser acceptance tests should assert behavior, not exact pixels.
- Visual fidelity can be reviewed manually against `docs/design/assets/figma/schema-fields.png`.

## Phase 3 Design Breakdown

### Task 6: Generation Form, Progress, And Replacement Confirmation

Figma evidence:

- `Mock data generation` shows record count, include-null switch, endpoint field, and generate button.

Implementation guidance:

- Implement validation for missing record count before generation.
- Use an orange full-width primary action.
- Add progress and replacement confirmation from the approved plan even though they are not shown in the captured Figma screen.

### Task 7: Paginated Data Preview

Figma evidence:

- `Mock data generation` shows the generated records table.

Implementation guidance:

- Use compact table rows and sortable headers.
- Truncate long values in cells.
- Support nested values with expandable JSON behavior from the acceptance criteria.

## Recommended Low-Usage Implementation Order

Use one PR per row:

| PR | Scope | Figma reference | Local tests |
|---:|---|---|---|
| 1 | Phase 2 domain models only | Schema with fields | Domain tests only |
| 2 | Schema persistence and version snapshots | Version badge | Domain and DB integration |
| 3 | Add/edit/delete schema mutations | Add Field and row menu | Route integration and focused browser |
| 4 | Recursive schema builder UI | Schema with fields | Component and one acceptance flow |
| 5 | Version history, diff, rollback, download | No direct frame | Domain, route, focused browser |
| 6 | Phase 2 acceptance proof | Schema with fields | Phase 2 acceptance only |
| 7 | Phase 3 generation form and jobs | Mock data generation | Generation domain and route tests |
| 8 | Generated records preview | Mock data generation | Component and browser preview |

This keeps each session small and lets GitHub CI handle the broad verification after each PR.
