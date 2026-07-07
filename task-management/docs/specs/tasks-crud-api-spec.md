# Spec: Full CRUD REST API for Tasks

## Overview

Replace the in-memory `TasksService` stub with a fully wired REST API for tasks, backed by the existing (already-tested) `TasksRepository`. Adds Create, Read (list + single), Update, and Delete endpoints with request validation and standard HTTP error semantics.

## Slice 1: View Tasks (read endpoints wired to real data)

The walking skeleton — replaces the in-memory stub with real reads from Postgres and adds single-task lookup. Also introduces the shared `ZodValidationPipe` (in `src/common/pipes/`) and the pagination/UUID param schemas, since this slice's own 400-response ACs already require schema-driven validation — later slices reuse this pipe rather than each building their own.

- [x] `GET /tasks` returns all tasks from Postgres via `TasksRepository` (no longer the in-memory stub)
- [x] `GET /tasks` returns an empty array when no tasks exist
- [x] `GET /tasks` supports `limit` and `offset` query params to page through results, defaulting to `limit=20` when `limit` is omitted
- [x] `GET /tasks` returns 400 when `limit` or `offset` is not a non-negative integer
- [x] `GET /tasks` returns a bare array of tasks (no pagination metadata wrapper)
- [x] `GET /tasks/:id` returns the matching task when it exists
- [x] `GET /tasks/:id` returns 404 when no task exists with that id
- [x] `GET /tasks/:id` returns 400 when the `:id` path param is not a valid UUID
- [x] Every returned task serializes `createdAt` as an ISO 8601 string
- [x] A reusable `ZodValidationPipe` exists in `src/common/pipes/` and is used (via parameter-scoped instances, e.g. `@Param('id', new ZodValidationPipe(...))`, `@Query(...)`) to validate `limit`/`offset`/`:id` in this slice
- [x] Controller-level unit tests cover `GET /tasks` and `GET /tasks/:id` (via `Test.createTestingModule` with a `useValue`-mocked `TasksService`), in addition to service-level tests

## Slice 2: Create a Task

Builds on Slice 1 — introduces write capability, reusing the `ZodValidationPipe` built in Slice 1 with a new `CreateTaskSchema`.

- [x] `POST /tasks` creates a new task and returns it with 201 status
- [x] Created task response includes a generated `id` and `createdAt` timestamp
- [x] Created task defaults to status `OPEN` when `status` is omitted from the request
- [x] `POST /tasks` returns 400 when `title` is missing or an empty string
- [x] `POST /tasks` returns 400 when `title` exceeds 200 characters
- [x] `POST /tasks` returns 400 when `description` exceeds 2000 characters
- [x] `POST /tasks` returns 400 when `status` is not one of `OPEN`, `IN_PROGRESS`, `DONE`
- [x] `POST /tasks` returns 400 when the request body includes `id` or `createdAt`
- [x] A created task is retrievable via `GET /tasks/:id` immediately after creation
- [x] Controller-level unit tests cover `POST /tasks` (via `Test.createTestingModule` with a `useValue`-mocked `TasksService`), in addition to service-level tests

## Slice 3: Update a Task

Builds on Slices 1-2 — partial update of an existing task, reusing the same validation pipe pattern.

- [x] `PATCH /tasks/:id` updates any combination of `title`, `description`, and `status` when included in the body
- [x] `PATCH /tasks/:id` leaves fields not included in the body unchanged
- [x] `PATCH /tasks/:id` returns 200 with the unchanged task when the body is empty (`{}`)
- [x] `PATCH /tasks/:id` returns 404 when no task exists with that id
- [x] `PATCH /tasks/:id` returns 400 when the `:id` path param is not a valid UUID
- [x] `PATCH /tasks/:id` returns 400 when `title` is an empty string or exceeds 200 characters
- [x] `PATCH /tasks/:id` returns 400 when `description` exceeds 2000 characters
- [x] `PATCH /tasks/:id` returns 400 when `status` is not one of `OPEN`, `IN_PROGRESS`, `DONE`
- [x] `PATCH /tasks/:id` returns 400 when the body includes `id` or `createdAt`
- [x] Controller-level unit tests cover `PATCH /tasks/:id` (via `Test.createTestingModule` with a `useValue`-mocked `TasksService`), in addition to service-level tests

## Slice 4: Delete a Task

Builds on Slices 1-3 — completes the CRUD surface.

- [x] `DELETE /tasks/:id` deletes the task and returns 204 No Content
- [x] `DELETE /tasks/:id` returns 404 when no task exists with that id
- [x] `DELETE /tasks/:id` returns 400 when the `:id` path param is not a valid UUID
- [x] A deleted task no longer appears in `GET /tasks` or is retrievable via `GET /tasks/:id`
- [x] Controller-level unit tests cover `DELETE /tasks/:id` (via `Test.createTestingModule` with a `useValue`-mocked `TasksService`), in addition to service-level tests

## API Shape

```
POST   /tasks            { title, description?, status? } → 201 TaskResponseDto
GET    /tasks?limit=&offset=                              → 200 TaskResponseDto[]
GET    /tasks/:id                                          → 200 TaskResponseDto | 404
PATCH  /tasks/:id         { title?, description?, status? } → 200 TaskResponseDto | 404
DELETE /tasks/:id                                          → 204 | 404

TaskResponseDto: { id, title, description?, status, createdAt (ISO string) }
```

## Out of Scope

- Swagger/OpenAPI documentation (no `@nestjs/swagger` dependency added)
- Sorting or filtering tasks by status or any other field (only `limit`/`offset` pagination)
- Authentication/authorization (single-tenant, unauthenticated API)
- Field-level validation error messages or a custom error envelope — using Nest's default `BadRequestException`/`NotFoundException` JSON shape (`{ statusCode, message, error }`)
- `PUT` (full replace) semantics — `PATCH` (partial update) only
- Bulk create/update/delete operations
- Soft delete or audit/history trail
- Rate limiting, caching, logging middleware

## Technical Context

- Patterns to follow: Controller → Service → Repository → Drizzle (`DATABASE_CONNECTION` token), symbol-based DI tokens, Vitest (`describe`/`it`/`expect`/`vi`), co-located `*.spec.ts` files.
- Test coverage: every slice's tests should cover the Zero/One/Many/Boundary/Interface/Exception cases where applicable (e.g. empty list, single item, multiple items, boundary values like max-length strings, contract/shape checks, error paths) — but do **not** add `// Z`, `// O`, `// M`, `// B`, `// I`, `// E` comment headers to new tests, even though existing specs in this codebase use that convention.
- Controller test coverage is explicit, not optional: each slice must include controller-level unit tests for its new endpoint(s), following the existing `tasks.controller.spec.ts` pattern (`Test.createTestingModule` + `useValue`-mocked `TasksService`), in addition to service-level tests. This is called out per-slice above.
- Status literals: always derive from the existing `TaskStatus` Zod enum in `task.schema.ts` (e.g. `TaskStatus.enum.OPEN`) — never hand-roll a separate enum.
- New infra to build (Slice 1): `ZodValidationPipe` in `src/common/pipes/zod-validation.pipe.ts` — a generic `PipeTransform` taking any `ZodType`, calls `.safeParse()`, throws `BadRequestException` on failure. Applied as **parameter-scoped instances** (`@Body(new ZodValidationPipe(schema))`, `@Param('id', new ZodValidationPipe(z.uuid()))`, `@Query(...)`) — not method-level `@UsePipes` (PATCH needs different schemas for body vs param) and not a custom decorator (too few call sites to justify it yet).
- `CreateTaskSchema`/`CreateTaskDto` and `UpdateTaskSchema`/`UpdateTaskDto` in `task.schema.ts` — both built from `TaskStatus`, with `title` capped at 200 chars, `description` capped at 2000 chars, and `.strict()` (or equivalent) so `id`/`createdAt` are rejected as unknown keys. Plus a `PaginationQuerySchema` (coerced non-negative ints, `limit` default 20) and a UUID param schema, both needed starting Slice 1.
- Key dependencies: `TasksRepository` (`src/tasks/tasks.repository.ts`) already has full CRUD against Postgres and is fully tested — do not modify it. `TaskResponseSchema` defines the response DTO shape (`createdAt` as ISO string).
- `TasksService` becomes a thin delegation layer over `TasksRepository` (no more in-memory array); `TasksController` maps `Task` → `TaskResponseDto` and applies the validation pipe to incoming requests.
- Risk level: MODERATE

[x] Reviewed
