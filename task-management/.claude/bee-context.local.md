## Context Summary

Analysis method: text-based pattern matching (LSP not available in this environment)

### Project Structure
- **Stack**: TypeScript, NestJS 11, Node, Drizzle ORM (postgres-js), Zod 4, pnpm workspace (`packageManager: pnpm@10.33.2`)
- **Build**: `nest build` (Nest CLI); dev via `nest start --watch`; entry point `task-management/src/main.ts`
- **Layout**: Single NestJS app at `task-management/`, feature modules under `src/`: `tasks/`, `users/`, `auth/`, plus `infra/database/` for persistence and `common/` for cross-cutting pipes/filters. Tests live in top-level `__tests__/` mirroring `src/`.
- **Key dependencies**: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `drizzle-orm` + `postgres`, `zod`, `bcrypt`. `@nestjs/terminus` NOT present — needs adding.

### Architecture Pattern
- MVC-style layering (NestJS convention): Controller -> Service -> Repository -> Drizzle connection.
- Dependency direction: domain modules depend on `infra/database/database.module.ts` via `DATABASE_CONNECTION` DI token; infra never imports domain. `AppModule` composes all feature modules plus global `DatabaseModule`/`ConfigModule`.

### Test Infrastructure
- Framework: Vitest (`vitest.config.ts`). Legacy Jest e2e config also exists but new work should follow Vitest pattern.
- Location: top-level `task-management/__tests__/` mirroring `src/`. Import via `@src/...` alias.
- Naming: `*.spec.ts` and some `*.test.ts`.
- Run: `pnpm test` (`vitest run`).
- Mocking: `Test.createTestingModule` with real/stub providers passed directly — no jest.fn/vi.fn mocking lib for controller-level unit tests.
- Integration tests hit real Postgres via `DATABASE_URL`, migrated in `beforeAll`, truncated in `beforeEach`. `vitest.config.ts` sets `fileParallelism: false` for this reason.

### Project Conventions
- No CLAUDE.md in task-management/ or repo root.
- ESLint 9 flat config, relaxed rules (`no-explicit-any: off`, etc).
- Commit style: conventional-commit-like (`fix:`, `build:`, `build(docker):`).
- Modules: strict 4-file-per-feature shape (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`). DI via `@Inject(DATABASE_CONNECTION)`. Controllers thin; guards applied per-controller (`@UseGuards(AuthGuard)` only on `TasksController`; `AppController`/`UsersController` unguarded).

### Change Area
- No existing health-check code anywhere in task-management/.
- `AppController` is the only unguarded top-level controller today (`GET /` -> "Hello World!" via `AppService`).
- Files to add/modify:
  - `task-management/package.json` — add `@nestjs/terminus`
  - `task-management/src/app.module.ts` — register new health module
  - New module `task-management/src/health/health.module.ts` + `health.controller.ts` (no service/repository needed — thin Terminus wrapper, per YAGNI)
  - New test(s) under `task-management/__tests__/health/`, `.spec.ts` naming
- DB connectivity check must reuse the existing `DATABASE_CONNECTION` token / `Database` type from `infra/database/database.module.ts` (which is `@Global()` — injectable anywhere without re-import). No Terminus Drizzle indicator exists — write custom indicator wrapping a lightweight query (e.g. `SELECT 1`).
- Endpoint should be unguarded/public (matches liveness/readiness probe convention, and matches `AppController`/`UsersController` unguarded pattern).
- No throttler, no logging/audit infra elsewhere — none expected here.

### Existing Documentation
- Specs: `task-management/docs/specs/tasks-crud-api-spec.md`, `user-authentication-spec.md`, `users-and-task-assignee-mapping-spec.md`. No spec yet for health checks.
- No ADRs directory.
- `task-management/docs/architecture-assessment.md` confirms layering, notes `DATABASE_CONNECTION`/`Database` as stable DB-connection concern.

### Tidy Opportunities
None — area is clean/greenfield.

### Design System
UI-involved: no. Backend-only NestJS API.
