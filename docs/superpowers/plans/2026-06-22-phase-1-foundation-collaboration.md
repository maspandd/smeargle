# Phase 1 Foundation and Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure email/password access, project-scoped roles, the dashboard, project creation, and membership management.

**Architecture:** Bootstrap the modular Next.js application and PostgreSQL persistence, then keep authentication and project authorization in feature modules used by thin Server Actions and Route Handlers. Project creation and membership changes are transactional and append audit events.

**Tech Stack:** Next.js App Router, TypeScript, pnpm, PostgreSQL, Prisma, Zod, Argon2, secure database sessions, Tailwind CSS, Vitest, Testing Library, Playwright

---

### Task 1: Bootstrap the application and test harness

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `tests/setup.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Scaffold the pinned application dependencies**

Run:

```powershell
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
pnpm add @prisma/client zod argon2
pnpm add -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: Next.js files are created, dependency versions are pinned in `pnpm-lock.yaml`, and no command reports a dependency-resolution error.

- [ ] **Step 2: Add deterministic test scripts**

Set the `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  }
}
```

- [ ] **Step 3: Configure Vitest path aliases and DOM setup**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["tests/setup.ts"] },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Document required environment variables**

Create `.env.example`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mock_data_generator
SESSION_COOKIE_NAME=mock_data_session
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 5: Run the bootstrap verification**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit 0; Vitest may report no test files at this bootstrap boundary.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts playwright.config.ts src tests .env.example .gitignore
git commit -m "chore: bootstrap mock data generator"
```

### Task 2: Persist users, sessions, projects, membership, and audit events

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `tests/integration/database-schema.test.ts`
- Create: `tests/helpers/database.ts`

- [ ] **Step 1: Write the failing persistence test**

Create `tests/integration/database-schema.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";

describe("project persistence", () => {
  afterEach(resetDatabase);

  it("stores one owner and an immutable creation audit event", async () => {
    const user = await prisma.user.create({
      data: { email: "owner@example.test", passwordHash: "hash" },
    });
    const project = await prisma.project.create({
      data: {
        name: "Products API",
        baseEndpoint: "/api/products",
        routeKey: "products_test_key",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        auditEvents: {
          create: { actorId: user.id, action: "PROJECT_CREATED", metadata: {} },
        },
      },
      include: { memberships: true, auditEvents: true },
    });

    expect(project.memberships).toHaveLength(1);
    expect(project.memberships[0].role).toBe("OWNER");
    expect(project.auditEvents[0].action).toBe("PROJECT_CREATED");
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm vitest run tests/integration/database-schema.test.ts`

Expected: FAIL because `@/lib/db` and the Prisma models do not exist.

- [ ] **Step 3: Define the minimum Prisma schema**

Create `prisma/schema.prisma` with PostgreSQL datasource, Prisma client generator, enums `SystemRole`, `ProjectRole`, and `AuditAction`, and the `User`, `Session`, `Project`, `ProjectMembership`, and `AuditEvent` models required by the test. Add unique constraints for email, route key, and `(projectId,userId)`, and cascading deletes only for project-owned rows.

The critical model fields are:

```prisma
model ProjectMembership {
  projectId String
  userId    String
  role      ProjectRole
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())
  @@id([projectId, userId])
}

model AuditEvent {
  id        String      @id @default(cuid())
  actorId   String?
  projectId String?
  action    AuditAction
  metadata  Json
  createdAt DateTime    @default(now())
  actor     User?       @relation(fields: [actorId], references: [id], onDelete: SetNull)
  project   Project?    @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Add the database singleton and reset helper**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Create `tests/helpers/database.ts`:

```ts
import { prisma } from "@/lib/db";

export async function resetDatabase() {
  await prisma.auditEvent.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
```

- [ ] **Step 5: Migrate and verify GREEN**

Run:

```powershell
pnpm prisma migrate dev --name foundation
pnpm vitest run tests/integration/database-schema.test.ts
```

Expected: migration succeeds and the test passes.

- [ ] **Step 6: Commit**

```powershell
git add prisma src/lib/db.ts tests/helpers/database.ts tests/integration/database-schema.test.ts
git commit -m "feat: add collaboration persistence"
```

### Task 3: Implement password accounts and secure sessions

**Files:**
- Create: `src/features/auth/password.ts`
- Create: `src/features/auth/session.ts`
- Create: `src/features/auth/auth-service.ts`
- Create: `src/features/auth/auth-service.test.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: Write failing password and session tests**

Create `src/features/auth/auth-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./session";

describe("authentication primitives", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-42");
    expect(hash).not.toContain("Correct-Horse-42");
    await expect(verifyPassword(hash, "Correct-Horse-42")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("creates an opaque session token and a distinct database hash", () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/auth/auth-service.test.ts`

Expected: FAIL because password and session modules do not exist.

- [ ] **Step 3: Implement the minimum primitives**

Create `src/features/auth/password.ts` using `argon2.hash` with Argon2id and `argon2.verify`. Create `src/features/auth/session.ts` using 32 random bytes encoded as base64url and SHA-256 for the stored token hash.

Required public API:

```ts
export async function hashPassword(password: string): Promise<string>;
export async function verifyPassword(hash: string, password: string): Promise<boolean>;
export function createSessionToken(): string;
export function hashSessionToken(token: string): string;
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run src/features/auth/auth-service.test.ts`

Expected: both tests pass.

- [ ] **Step 5: Add login service behavior test first**

Add a test that creates a user, calls `login({email,password})`, and asserts the returned plaintext token maps to a hashed, expiring database session. Add rejection tests for an unknown email, wrong password, and disabled account. Run and observe missing `login` failures before implementing `auth-service.ts`.

- [ ] **Step 6: Implement login and the login page**

Implement `login`, `logout`, and `requireUser` in `auth-service.ts`. Validate credentials with Zod, use a generic `Invalid email or password` error, rotate the session on login, set `HttpOnly`, `SameSite=Lax`, `Secure` in production, and a fixed path `/`.

The Server Action returns serializable field/form errors and redirects to `/dashboard` only after the session cookie is set.

- [ ] **Step 7: Run affected verification**

Run:

```powershell
pnpm vitest run src/features/auth/auth-service.test.ts
pnpm typecheck
pnpm lint
```

Expected: all commands pass without warnings.

- [ ] **Step 8: Commit**

```powershell
git add src/features/auth src/app/(auth)
git commit -m "feat: add password authentication"
```

### Task 4: Create projects transactionally

**Files:**
- Create: `src/features/projects/project-schema.ts`
- Create: `src/features/projects/project-service.ts`
- Create: `src/features/projects/project-service.test.ts`
- Create: `src/lib/route-key.ts`

- [ ] **Step 1: Write failing validation tests**

Create tests asserting blank name returns `Project name is required`, `products` returns `Endpoint must start with /`, query strings/fragments are rejected, and `/api/products/` normalizes to `/api/products`.

Use this desired API:

```ts
const result = createProjectInput.safeParse({
  name: "E-commerce Products API",
  baseEndpoint: "/api/products/",
});
expect(result.success && result.data.baseEndpoint).toBe("/api/products");
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/projects/project-service.test.ts`

Expected: FAIL because `createProjectInput` does not exist.

- [ ] **Step 3: Implement validation and verify GREEN**

Implement a Zod schema that trims names, normalizes repeated/trailing slashes, rejects platform-reserved `/api/mock`, and exposes field-specific messages. Run the focused test and expect PASS.

- [ ] **Step 4: Write the failing transaction test**

Add an integration test calling:

```ts
const project = await createProject({
  actorId: user.id,
  name: "E-commerce Products API",
  baseEndpoint: "/api/products",
});
expect(project.currentVersion).toBe("v1.0");
expect(await prisma.projectMembership.count({ where: { projectId: project.id, role: "OWNER" } })).toBe(1);
expect(await prisma.auditEvent.count({ where: { projectId: project.id, action: "PROJECT_CREATED" } })).toBe(1);
```

Run and confirm failure because `createProject` is missing.

- [ ] **Step 5: Implement the project transaction**

Generate a collision-resistant route key, create the project, v1.0 placeholder version reference required by Phase 2, Owner membership, and audit event inside `prisma.$transaction`. If Phase 2 models are not present yet, store `currentMajor=1` and `currentMinor=0` on Project and migrate those fields to a version relation in Phase 2.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run src/features/projects/project-service.test.ts tests/integration/database-schema.test.ts`

Expected: PASS.

```powershell
git add src/features/projects src/lib/route-key.ts prisma tests
git commit -m "feat: create versioned projects"
```

### Task 5: Enforce project roles

**Files:**
- Create: `src/features/projects/authorization.ts`
- Create: `src/features/projects/authorization.test.ts`

- [ ] **Step 1: Write the failing role matrix test**

```ts
import { describe, expect, it } from "vitest";
import { can } from "./authorization";

describe("project authorization", () => {
  it.each([
    ["OWNER", "manage_members", true],
    ["EDITOR", "manage_members", false],
    ["EDITOR", "edit_schema", true],
    ["VIEWER", "edit_schema", false],
    ["VIEWER", "view_project", true],
  ] as const)("allows %s to %s = %s", (role, capability, expected) => {
    expect(can(role, capability)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/projects/authorization.test.ts`

Expected: FAIL because `can` is missing.

- [ ] **Step 3: Implement the explicit capability map**

Implement `ProjectCapability` and a readonly map for Owner, Editor, and Viewer. Add `requireProjectCapability({userId,projectId,capability})` that checks system admin first, then active membership, and throws a typed `ForbiddenError`.

- [ ] **Step 4: Verify role and database checks**

Add integration tests for no membership, Viewer rejection, Owner success, and system administrator override. Run focused tests and expect PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/projects/authorization.ts src/features/projects/authorization.test.ts tests/integration
git commit -m "feat: enforce project roles"
```

### Task 6: Build dashboard and project creation UI

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/features/projects/components/create-project-dialog.tsx`
- Create: `src/features/projects/components/create-project-dialog.test.tsx`
- Create: `src/app/(app)/projects/[projectId]/page.tsx`
- Create: `src/app/(app)/projects/actions.ts`

- [ ] **Step 1: Write the failing dialog behavior tests**

Test that Save with blank name renders `Project name is required`, invalid endpoint renders `Endpoint must start with /`, Cancel closes without calling the action, and valid submit passes normalized values.

Use Testing Library queries by role and accessible label, for example:

```ts
await user.click(screen.getByRole("button", { name: "Save Project" }));
expect(screen.getByText("Project name is required")).toBeVisible();
expect(onSubmit).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/projects/components/create-project-dialog.test.tsx`

Expected: FAIL because the dialog does not exist.

- [ ] **Step 3: Implement the minimum accessible dialog**

Render labelled inputs, field-level errors linked by `aria-describedby`, focus the first invalid field, and support Cancel plus overlay dismissal. Call the Server Action only after client validation; repeat validation and authorization on the server.

- [ ] **Step 4: Add dashboard and project workspace**

The dashboard lists only accessible projects with name, endpoint, role, and blue version badge. Empty state uses `Create First Mock API`. Successful creation redirects to `/projects/{id}` where an empty Schema Builder and `Add Field` button are visible.

- [ ] **Step 5: Verify components and page types**

Run:

```powershell
pnpm vitest run src/features/projects/components/create-project-dialog.test.tsx
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/(app) src/features/projects/components
git commit -m "feat: add project dashboard"
```

### Task 7: Manage project members and protect the last owner

**Files:**
- Create: `src/features/projects/membership-service.ts`
- Create: `src/features/projects/membership-service.test.ts`
- Create: `src/app/(app)/projects/[projectId]/members/page.tsx`
- Create: `src/app/(app)/projects/[projectId]/members/actions.ts`

- [ ] **Step 1: Write failing membership invariant tests**

Test Owner can add Editor/Viewer, Editor cannot manage members, duplicate membership is rejected, and demoting/removing the last Owner returns `Project must retain at least one owner`.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm vitest run src/features/projects/membership-service.test.ts`

Expected: FAIL because membership mutations do not exist.

- [ ] **Step 3: Implement transactional membership mutations**

Implement `addMember`, `changeMemberRole`, and `removeMember`. Lock/count Owners inside the transaction before removal or demotion, authorize `manage_members`, and append a precise audit event.

- [ ] **Step 4: Verify GREEN and add the member page**

Run the focused service tests until they pass. Then add an Owner-only member table with role select, remove confirmation, empty search result, and disabled last-owner controls carrying explanatory text.

- [ ] **Step 5: Run affected suites and commit**

```powershell
pnpm vitest run src/features/projects
pnpm typecheck
pnpm lint
git add src/features/projects src/app/(app)/projects/[projectId]/members
git commit -m "feat: manage project membership"
```

### Task 8: Prove Phase 1 acceptance criteria

**Files:**
- Create: `tests/acceptance/authentication.spec.ts`
- Create: `tests/acceptance/project-creation.spec.ts`
- Create: `tests/acceptance/project-membership.spec.ts`
- Modify: `docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md`

- [ ] **Step 1: Write the failing browser scenarios**

Cover login success/rejection, AC-01.01 through AC-01.04, Viewer read-only behavior, Editor mutation permission, Owner member management, and last-owner protection. Use seeded test users and projects through a test-only database fixture script, not test-only production endpoints.

- [ ] **Step 2: Run to verify RED**

Run: `pnpm test:e2e --grep "Phase 1"`

Expected: at least one scenario fails for a missing selector or behavior; record the exact expected failure before changing production code.

- [ ] **Step 3: Make the minimum acceptance fixes**

Fix only behavior exposed by the failing scenarios. Do not weaken assertions or add arbitrary waits; wait on visible states or navigation.

- [ ] **Step 4: Run the complete Phase 1 gate**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e --grep "Phase 1"
pnpm build
```

Expected: every command exits 0 with no unhandled console errors.

- [ ] **Step 5: Mark Phase 1 traceability and commit**

Update AC-01.01 through AC-01.04 and added account/role criteria with the final test paths.

```powershell
git add tests/acceptance docs/superpowers/specs/2026-06-22-mock-data-generator-acceptance-traceability.md
git commit -m "test: verify foundation acceptance criteria"
```

