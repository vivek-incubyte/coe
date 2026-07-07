## Architecture: Full CRUD REST API for Tasks

**Pattern**: Layered (Controller → Service → Repository → Drizzle) — unchanged, existing pattern confirmed as the right fit. No onion/hexagonal/CQRS/event-driven warranted (single entity, no cross-entity rules, no multiple input channels).

**Start with**: Thin `TasksService` delegating directly to `TasksRepository`; `TasksController` maps `Task` → `TaskResponseDto` and applies parameter-scoped `ZodValidationPipe` instances to `@Body()`/`@Param()`/`@Query()`.

**File structure**:

- `src/common/pipes/zod-validation.pipe.ts` — generic `PipeTransform` taking a `ZodType`, calls `.safeParse()`, throws `BadRequestException` with the Zod issues on failure. **Confirmed location: `src/common/pipes/`** (reused 3+ times in this spec alone: create/update body, id param, pagination params — idiomatic Nest CLI convention for cross-cutting pipes).
- `src/tasks/task.schema.ts` — add `CreateTaskSchema`/`CreateTaskDto`, `UpdateTaskSchema`/`UpdateTaskDto` (`.strict()`, derived from `TaskStatus`), plus a `PaginationQuerySchema` (coerced, non-negative ints, `limit` default 20) and a UUID param schema — all needed starting Slice 1.
- `src/tasks/tasks.service.ts` — delegation methods `findAll`, `findOne`, `create`, `update`, `remove` wrapping `TasksRepository`; `findOne`/`update`/`remove` translate repository `null` into `NotFoundException`.
- `src/tasks/tasks.controller.ts` — 5 routes, each applying the relevant `ZodValidationPipe(schema)` **as a parameter-scoped instance** (e.g. `@Body(new ZodValidationPipe(CreateTaskSchema))`, `@Param('id', new ZodValidationPipe(z.uuid()))`) — confirmed over method-level `@UsePipes` (PATCH needs different schemas for body vs param) and over a custom decorator (only 4-5 call sites, not worth the indirection yet).

**Key boundaries**: The Zod validation pipe is the HTTP-input boundary — untrusted external data is validated at the edge; everything past the controller can assume valid, typed data. `TasksRepository` remains untouched and is the persistence boundary.

**Dependency direction**: `tasks/` → `common/` (never the reverse) → nothing external. Controller → Service → Repository → DB connection token, one direction only.

**Infra-timing decision (confirmed)**: `ZodValidationPipe` + `PaginationQuerySchema` + UUID param validation are built in **Slice 1**, not Slice 2 — Slice 1's own ACs (400 on invalid limit/offset, 400 on invalid :id) already require schema-driven validation, so building it there avoids throwaway ad hoc validation that Slice 2 would otherwise replace. Slice 2 then reuses the existing pipe for `CreateTaskSchema` rather than introducing it. Slice order itself (View → Create → Update → Delete) is unchanged — this only moves the creation point of shared infra to the earliest slice that needs it.

## Evolution Triggers

- Second feature module needs request validation → `common/pipes/zod-validation.pipe.ts` is already positioned for reuse; nothing to extract.
- `TasksService` grows business rules beyond pure delegation (status-transition rules, cross-entity checks) → extract a small domain/validation layer inside `tasks/`; don't preemptively add one now.
- Error responses need a custom shape/envelope (currently out of scope) → introduce a shared exception filter in `common/filters/`.
- A second bounded-context module arrives with its own entities/rules → reconsider flat `src/` feature folders in favor of a modular-monolith layout with explicit module boundaries.
