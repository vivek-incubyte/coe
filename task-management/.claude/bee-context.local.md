## Context: Task Search Feature

Analysis method: text-based pattern matching (no LSP tool available in this environment — findings are grep/read-based)

### Project Structure

- **Stack**: TypeScript, NestJS 11, Node, Drizzle ORM 0.45 + Postgres, Zod 4.4 for validation
- **Build**: pnpm, `nest build`; Vitest 4 for unit/integration tests
- **Layout**: Single NestJS app, feature-module style — `src/tasks/` (domain module), `src/infra/database/` (connection/schema/migrations), `src/common/` (generic pipes)

### Architecture Pattern

- Layered CRUD — Controller → Service → Repository → Drizzle
- `TasksController` (`src/tasks/tasks.controller.ts`) → `TasksService` (`src/tasks/tasks.service.ts`) → `TasksRepository` (`src/tasks/tasks.repository.ts`) → Drizzle
- Domain Zod schema (`task.schema.ts`) is a shared kernel imported by all layers and all specs

### Test Infrastructure

- Framework: Vitest, co-located `*.spec.ts` next to source
- Run command: `npm test` (= `vitest run`)
- Mocking: `vi.fn()` for repository/service test doubles; controller tests use `Test.createTestingModule` with `useValue`-mocked service
- Integration tests: `tasks.repository.spec.ts` runs real integration tests against Postgres via `TEST_DATABASE_URL`, using `drizzle-migrate` in `beforeAll`, `db.delete(TABLE_TASKS)` in `beforeEach`, `sql.end()` in `afterAll` — this is the pattern for any new repository search method
- Per project convention (user memory): no ZOMBIES letter-comment headers in test files, even though older specs have them

### Project Conventions

- Status literals always derive from the `TaskStatus` Zod enum (`TaskStatus.enum.OPEN`) — never hand-rolled (user memory: no enum files in task-management)
- Validation via `ZodValidationPipe` applied as parameter-scoped instances (`@Query(new ZodValidationPipe(Schema))`)
- Repository input/output types (`CreateTaskInput`, `UpdateTaskInput`) are distinct from wire-shape DTOs — intentional layering
- Commit style: Conventional commits (`feat(tasks): ...`, `fix(database): ...`)

### Change Area

- `GET /tasks` (`TasksController.findAll`) already accepts `PaginationQuerySchema` (`limit`/`offset`) via `@Query(new ZodValidationPipe(...))`, calls `TasksService.findAll(pagination)` → `TasksRepository.findAll(pagination)` → `db.select().from(TABLE_TASKS).orderBy(asc(...)).limit().offset()`
- Files likely to change:
  - `src/tasks/task.schema.ts` — extend query schema with an optional `search` string field
  - `src/tasks/tasks.repository.ts` — `findAll` needs a `where` clause matching `title` OR `description` case-insensitively when search term present (`ilike` from `drizzle-orm`, or `or(ilike(...), ilike(...))`) — no such import exists yet in repo, this will be the first compound `where` predicate here
  - `src/tasks/tasks.controller.ts` / `tasks.service.ts` — likely pass-through, no logic change needed since they already forward the whole pagination/query object
  - Spec files: `task.schema.spec.ts`, `tasks.repository.spec.ts` (integration), `tasks.service.spec.ts`, `tasks.controller.spec.ts`
- `description` column is nullable — need to double check `ilike` OR predicate null handling
- **Decision requested by developer**: search matches **title and description** (case-insensitive)

### Existing Documentation

- `docs/specs/tasks-crud-api-spec.md` — CRUD spec (Slices 1-4, all done). Explicitly lists "Sorting or filtering tasks by status or any other field" as Out of Scope — so this search feature is a net-new capability beyond that spec
- `docs/architecture-assessment.md` — flags pre-existing `TaskStatus`/`taskStatusEnum` duplication (unrelated, out of scope for this task)

### Design System

- UI-involved: no — backend-only NestJS REST API
