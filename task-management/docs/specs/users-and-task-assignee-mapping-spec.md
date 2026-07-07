# Spec: Users and Task Assignee Mapping

## Overview
Introduce a Users resource (create + list only) and let a Task optionally be assigned to a single User via `userId`. Tasks may exist unassigned, and unassigning happens automatically if the assigned user is later deleted.

## Slice 1: Users module — create and list users

- [x] Can create a user by providing `name` and `email`
- [x] Created user response includes `id`, `name`, `email`, and `createdAt`
- [x] Shows error when `name` is missing or empty
- [x] Shows error when `email` is missing
- [x] Shows error when `email` is not a valid email format
- [x] Shows error when `email` is already registered by another user
- [x] Email uniqueness check is case-insensitive (`Foo@x.com` and `foo@x.com` are treated as the same email and the second create is rejected)
- [x] Can list all users
- [x] A newly created user appears in the list of all users

## Slice 2: Task-user assignee mapping

- [x] Can create a task without a `userId` (task is unassigned)
- [x] Can create a task with a `userId` referencing an existing user (task is assigned to that user)
- [x] Shows error when creating a task with a `userId` that does not match any existing user
- [x] Can update a task to set or change its `userId` to an existing user
- [x] Can update a task to unassign it by setting `userId` to null
- [x] Shows error when updating a task with a `userId` that does not match any existing user
- [x] Task responses (create, get by id, list, update) include `userId`, which is `null` when the task is unassigned
- [x] Deleting a user's underlying record unassigns any tasks previously assigned to them (`userId` becomes null) rather than deleting those tasks — verified at the repository/data level, since no delete-user endpoint exists yet

## API Shape

```
POST /users
{ name: string, email: string }
→ 201 { id, name, email, createdAt }
→ 400 when name/email missing or email format invalid
→ 409 when email already taken (case-insensitive)

GET /users
→ 200 [ { id, name, email, createdAt }, ... ]

POST /tasks
{ title, description?, status?, userId? }
→ 201 { id, title, description, status, userId, createdAt }
→ 400 when userId does not reference an existing user

PATCH /tasks/:id
{ title?, description?, status?, userId? }   // userId: null to unassign
→ 200 { id, title, description, status, userId, createdAt }
→ 400 when userId does not reference an existing user

GET /tasks, GET /tasks/:id
→ includes userId (null when unassigned) in the response
```

## Out of Scope
- Update or delete endpoints for Users (create + list only, per developer decision)
- Nested/joined user object in task responses — task payloads carry raw `userId` only, never `name`/`email`
- Filtering or searching tasks by `userId`
- Many-to-many task-user assignment, or separate "creator" vs "assignee" fields — single nullable assignee only
- Authentication/authorization on any endpoint (none exists in this codebase)

## Technical Context
- Patterns to follow: mirror the existing `src/tasks/` layering (Controller → Service → Repository → Drizzle) for the new `src/users/` module — no interfaces/ports, single concrete repository implementation (YAGNI).
- Zod schemas: `CreateUserSchema` as `z.strictObject`, response schema mirrors `TaskResponseSchema`'s `z.iso.datetime()` pattern for `createdAt`. No hand-rolled enum/const files.
- Persistence schema: new `TABLE_USERS` in `src/infra/database/schema/users.schema.ts`, re-exported via the schema barrel. `tasks.schema.ts` gains a nullable `userId` uuid column with `references(() => TABLE_USERS.id, { onDelete: 'set null' })`.
- Email uniqueness: enforce at the DB level (unique index/constraint) in a case-insensitive way (e.g. a functional unique index on lowercased email, or normalize-and-compare), not just in application code, to avoid race conditions.
- Migration: generate via `npm run db:generate` after schema changes — do not hand-write SQL.
- Existing task fixtures/tests (`makeTask` in tasks repository/service/controller specs) need a `userId` field added (defaulting to `null`/undefined for unassigned).
- Repository integration tests run against real Postgres (`TEST_DATABASE_URL`) using `migrate()` + truncate-before-each — the "deleting a user unassigns tasks" AC should be verified here since there is no delete-user API endpoint yet.
- Risk level: MODERATE.
