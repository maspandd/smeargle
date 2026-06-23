# Contribution Workflow

This guide explains how work moves through the repository and where project knowledge should live. It is intended for both solo work and future collaborators.

## Branch Protection

The default branch is `master`. It is protected by the GitHub ruleset **Protect Master**.

The ruleset currently enforces:

- No direct pushes to `master`; changes must go through a pull request.
- No force pushes.
- No branch deletion.
- Pull request conversations must be resolved before merge.
- Linear history is required.
- The branch must be up to date before merge.
- The required CI check must pass: `lint typecheck test build`.
- No bypass actors are configured.

## Daily Development Flow

1. Start from the latest `master`.
2. Create a feature branch with a clear name, for example `feature/project-export` or `fix/login-error-copy`.
3. Make focused commits that describe coherent changes.
4. Push the branch and open a pull request into `master`.
5. Wait for CI to pass.
6. Resolve review comments and conversations.
7. Merge through GitHub.
8. Delete the merged branch.

Do not push directly to `master`, even for small changes.

## Pull Request Checklist

Before requesting review or merging:

- Confirm the change is scoped to the PR description.
- Run focused tests for the changed behavior.
- Run affected tests when touching shared services, database schema, auth, permissions, or UI flows.
- Add or update documentation when behavior, setup, or workflow changes.
- Confirm CI passes on GitHub.
- Resolve all conversations.

## Local Verification

Use the package manager pinned in `package.json`:

```bash
corepack enable
pnpm install
```

Common checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm exec playwright test tests/acceptance
```

Database-backed tests require a PostgreSQL database and a valid `DATABASE_URL`. See `.env.example` for the expected variables.

## CI

GitHub Actions runs on pull requests into `master` and pushes to `master`.

The required check is named:

```text
lint typecheck test build
```

It runs:

- Dependency installation.
- Prisma client generation.
- Prisma migrations against PostgreSQL 18.
- ESLint.
- TypeScript type checking.
- Vitest unit and integration tests.
- Next.js production build.
- Playwright acceptance tests.

If CI fails, inspect the GitHub Actions logs, fix the branch, and push another commit. Do not bypass the ruleset.

## Project Knowledge

Keep durable knowledge in Markdown files rather than only in chat or PR comments.

Use these locations:

- `README.md` for high-level setup and project entry points.
- `docs/contributing/` for team workflow, collaboration, and onboarding.
- `docs/superpowers/specs/` for approved product and technical specifications.
- `docs/superpowers/plans/` for implementation plans and phase breakdowns.

When a specification and implementation disagree, document the conflict before changing the approved spec.

## When More People Collaborate

When the repository has regular collaborators, tighten the ruleset:

- Require at least one approving review.
- Require approval from someone other than the last pusher.
- Consider enabling stale review dismissal when new commits are pushed.
- Add code owners for sensitive areas such as auth, database schema, and permissions.
- Require signed commits if the team needs stricter provenance.

Keep the rule simple enough that contributors understand it, but strict enough that `master` remains releasable.
