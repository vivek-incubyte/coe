## Context Gatherer Report — Users + Task Assignee Mapping

### Project Structure
- Stack: TypeScript, NestJS 11, Drizzle ORM 0.45 (postgres-js driver), Zod 4, PostgreSQL
- Package manager: pnpm. Test runner: Vitest (unit + repository integration tests against real Postgres via TEST_DATABASE_URL). Jest e2e config exists but is dormant (no e2e spec files).
- Layout: src/tasks/ (feature module), src/infra/database/ (Drizzle schema + connection), src/common/ (shared ZodValidationPipe).

### Architecture Pattern
- Simple layered: Controller → Service → Repository → Drizzle connection. No ports/interfaces — repository is a concrete class, injected directly (YAGNI, single implementation).
- Two schema concepts per entity: domain/Zod schema (src/tasks/task.schema.ts) and persistence/Drizzle schema (src/infra/database/schema/tasks.schema.ts), re-exported via src/infra/database/schema/index.ts barrel.
- NotFoundException thrown from service layer, not repository. Repository returns null/false; service translates to HTTP exceptions.
- ZodValidationPipe reused generically per param/body: new ZodValidationPipe(SomeSchema).
- CreateXSchema uses z.strictObject(...); UpdateXSchema is .partial() of a strict object. Response DTOs serialize dates via z.iso.datetime() with a toResponseDto controller method.
- Repository has toX mapper: DB row → domain object, null→undefined for optional fields.
- Status/enum values MUST be derived from Zod schema, never a hand-rolled enum file — team already self-corrected this once (task.enum.ts was added then removed).

### Test Infrastructure
- Co-located *.spec.ts files, Vitest explicit imports (not globals).
- Service tests: hand-rolled mock repository object of vi.fn()s.
- Controller tests: Nest Test.createTestingModule with useValue mocks, vi.clearAllMocks() in beforeEach.
- Both use a makeX(overrides) fixture factory — replicate as makeUser(overrides).
- Repository integration tests: real Postgres via TEST_DATABASE_URL, migrate() in beforeAll, truncate table in beforeEach, sql.end() in afterAll. Fails fast if TEST_DATABASE_URL missing.
- Per user memory: cover ZOMBIES cases in tests but skip ZOMBIES letter-comment headers (legacy files still have them — don't propagate the comment style).

### Project Conventions
- No root CLAUDE.md. ESLint 9 flat config + Prettier. Conventional commits, scoped (e.g. feat(tasks): ..., fix(database): ...) — new work should use feat(users): ... scope.
- No auth/authz, no logging/caching/audit-trail infra anywhere — do not introduce for this task (YAGNI).

### Change Area — files to create/modify
New:
- src/infra/database/schema/users.schema.ts (pgTable users)
- src/users/user.schema.ts (Zod: CreateUserSchema, User type, response DTO)
- src/users/users.repository.ts, users.service.ts, users.controller.ts, users.module.ts + co-located *.spec.ts for each

Modify:
- src/infra/database/schema/index.ts — add `export * from './users.schema'`
- src/infra/database/schema/tasks.schema.ts — add userId FK column referencing users.id
- src/tasks/task.schema.ts — add userId to Task/CreateTaskSchema/response schema as decided
- src/tasks/tasks.repository.ts — map userId in toTask, accept in CreateTaskInput
- src/app.module.ts — import UsersModule
- Existing task test fixtures (makeTask in tasks.repository.spec.ts / tasks.service.spec.ts / tasks.controller.spec.ts) will need a userId field added

Migration: run `npm run db:generate` after schema changes — do not hand-write migration SQL. drizzle.config.ts needs no changes (already points at the schema barrel).

### Open business decisions (spec-builder must resolve, not infer)
- Is tasks.userId nullable (task can be unassigned) or required?
- FK onDelete behavior when a user is deleted: cascade / restrict / set null?
- What fields does User have beyond id (name, email — any uniqueness/format constraints)?

### Advisory (non-blocking)
- Naming collision risk: user.schema.ts (domain) vs users.schema.ts (Drizzle) mirrors the existing task.schema.ts vs tasks.schema.ts ambiguity already flagged in docs/architecture-assessment.md. Not fixing unilaterally — flag as an open question if it comes up.
- No tidy needed — Tasks module is clean, small, focused.

### Design System
UI-involved: no. Pure NestJS REST API, no frontend signals.
