## Context: Full CRUD API for Tasks

### Project Structure

- Stack: TypeScript, NestJS 11, Postgres via Drizzle ORM, Zod v4. Vitest for unit/integration tests (Jest config exists for e2e but unused, no e2e specs yet).
- Layout: single NestJS app, feature-module style. `src/tasks/` (controller, service, repository, schema, specs) + `src/infra/database/` (Drizzle connection, schema, migrations).
- Key deps: @nestjs/* core/common/config/platform-express, drizzle-orm + postgres driver, zod v4 (uses z.iso.datetime(), z.uuid() top-level helpers), drizzle-kit. No @nestjs/swagger, no nestjs-zod, no class-validator/class-transformer.

### Architecture Pattern

- Layered MVC-ish: Controller → Service → Repository → Drizzle DB connection (DATABASE_CONNECTION token from @Global() DatabaseModule).
- Currently incomplete: TasksService is an in-memory stub, NOT wired to TasksRepository (which already has full CRUD, Drizzle-backed, tested).
- Clean one-directional dependency flow, no violations found.

### Test Infrastructure

- Vitest (describe/it/expect/vi), co-located *.spec.ts next to source.
- Controller tests: `Test.createTestingModule` with `useValue` provider mocks (`vi.fn()`).
- Service tests: direct instantiation (`new TasksService()`) — will need mock repository once wired.
- Repository integration tests: real Postgres via `process.env.TEST_DATABASE_URL`, runs Drizzle migrations in beforeAll, truncates table in beforeEach, closes connection in afterAll.
- **Strict ZOMBIES-style test naming convention** across all specs: `// Z — Zero`, `// O — One`, `// M — Many`, `// B — Boundary`, `// I — Interface`, `// E — Exception`. New tests must follow this.

### Project Conventions

- No CLAUDE.md. User's standing memory: no hand-rolled enum files — derive status literals from the Zod schema (`TaskStatus = z.enum([...])` in task.schema.ts is already the single source of truth, referenced via `TaskStatus.enum.OPEN` etc). New DTOs must keep deriving from this schema.
- ESLint flat config, typescript-eslint recommendedTypeChecked + prettier. `no-explicit-any: off`, `no-floating-promises: warn`.
- Conventional commits (`feat(repository): ...`, `fix(database): ...`).
- DI via Nest `@Inject`/constructor injection; symbol token pattern (`DATABASE_CONNECTION`) is the template for new provider tokens.
- Repository maps raw Drizzle rows to domain objects via private `toTask()` mapper.
- Controller currently does DTO mapping inline in the route handler (no serialization pipe exists).

### Change Area

Files to modify:

- `src/tasks/tasks.service.ts` — inject TasksRepository, replace in-memory array with delegation; add findOne/create/update/remove.
- `src/tasks/tasks.controller.ts` — add POST, GET /:id, PATCH /:id, DELETE /:id alongside existing GET.
- `src/tasks/task.schema.ts` — add request DTOs (CreateTaskSchema/Dto, UpdateTaskSchema/Dto), deriving status from existing TaskStatus.
- `src/tasks/tasks.service.spec.ts`, `tasks.controller.spec.ts` — full rewrite/expansion needed.

Cross-cutting: **zero existing request validation** (no Zod pipe, no class-validator). **No exception filters** — no typed error hierarchy exists; 404/400 handling would rely on Nest's built-in HttpException/NotFoundException/BadRequestException, or a new Zod validation pipe would be new infra. This is a real architecture decision, not an established pattern to follow. No auth/logging/caching/rate-limiting anywhere — unauthenticated single-tenant API.

### Tidy Opportunities

None blocking. The current tasks.service.ts stub + its spec are throwaway and will be wholesale replaced as in-scope work (not pre-existing debt to tidy separately). No dead code, no skipped tests, no long functions found.

### Design System

UI-involved: no. Backend-only REST API, no frontend signals.
