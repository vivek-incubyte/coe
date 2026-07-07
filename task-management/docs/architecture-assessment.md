# Architecture Assessment: task-management

**Scope**: Full codebase (`/home/access2vivek/Documents/incubyte/coe/task-management`).
**Analysis method**: text-based pattern matching (no LSP/language server was available in this environment — dependency graphs were built via `Grep` over import statements; results are treated as a close approximation for a codebase this size, not exact symbol-usage counts).
**Git history note**: The repo shares a git root with a multi-day learning monorepo. Only **7 commits** touch `task-management/`, spanning 2026-06-26 to 2026-07-03 — well below the ~20-commit threshold for reliable hotspot/temporal-coupling signal. Behavioral findings below are directional observations from a young codebase, not statistically robust conclusions.

## Overview

This is a NestJS 11 + Drizzle ORM + Postgres + Zod backend for a task-management API. Single app, not a monorepo, organized as NestJS feature modules: `src/tasks/` (the one domain module so far) and `src/infra/database/` (DB connection/schema/migrations). A confirmed SDD spec (`docs/specs/tasks-crud-api-spec.md`) describes a Full CRUD REST API for tasks, not yet implemented — the repository layer is done and fully tested, but the service/controller layers are still mid-build.

## Domain Vocabulary

| Concept                                 | Source                                                      | Code Match                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task                                    | `docs/specs/tasks-crud-api-spec.md` (throughout)            | `src/tasks/task.schema.ts` (`Task`, `TaskSchema`) + `src/infra/database/schema/tasks.schema.ts` (`tasks` table)                                             |
| Task status (OPEN / IN_PROGRESS / DONE) | Spec ("status is not one of `OPEN`, `IN_PROGRESS`, `DONE`") | `TaskStatus` Zod enum in `task.schema.ts`; `taskStatusEnum` Postgres enum in `tasks.schema.ts` — values match exactly, but hand-duplicated (see Mismatches) |
| TaskResponseDto                         | Spec API Shape section                                      | `TaskResponseSchema`/`TaskResponseDto` — implemented                                                                                                        |
| CreateTaskSchema / CreateTaskDto        | Spec Slice 2                                                | Not yet in code — planned                                                                                                                                   |
| UpdateTaskSchema / UpdateTaskDto        | Spec Slice 3                                                | Not yet in code — `UpdateTaskInput` exists in `tasks.repository.ts` as a distinct persistence-layer type (intentional, not drift)                           |
| ZodValidationPipe                       | Spec Slice 1 (`src/common/pipes/zod-validation.pipe.ts`)    | Not yet in code — `src/common/` doesn't exist yet                                                                                                           |
| PaginationQuerySchema                   | Spec Slice 1                                                | Not yet in code                                                                                                                                             |
| TasksRepository                         | Spec ("already-tested `TasksRepository`")                   | `src/tasks/tasks.repository.ts` — implemented, matches exactly                                                                                              |
| TasksService                            | Spec ("thin delegation layer over `TasksRepository`")       | `src/tasks/tasks.service.ts` — currently an in-memory stub, due for replacement                                                                             |
| DATABASE_CONNECTION / Database          | Spec Technical Context                                      | `src/infra/database/database.module.ts` — matches exactly                                                                                                   |

## Boundary Map

- **`src/tasks/`** — owns the entire **Task** domain concept: schema, service, controller, repository. No split-brain ownership; this is the only domain module today.
- **`src/infra/database/schema/`** — owns the **persistence shape** of Task (Postgres table, `taskStatusEnum`), deliberately kept separate from the domain Zod schema per the intended Controller → Service → Repository → Drizzle layering.
- **`src/infra/database/`** (`database.module.ts`) — owns the DB **connection** concern (`DATABASE_CONNECTION` token), correctly excluded from `tasks/`.
- **`src/common/`** — planned, not yet built. Will own the generic `ZodValidationPipe`. Worth checking once built that it stays generic and no `Task`-specific logic leaks in.

Dependency graph (import-based):

```
main.ts → app.module.ts
app.module.ts → app.controller.ts, app.service.ts, infra/database/database.module.ts, tasks/tasks.module.ts
tasks.module.ts → tasks.controller.ts, tasks.repository.ts, tasks.service.ts
tasks.controller.ts → tasks.service.ts, task.schema.ts
tasks.service.ts → task.schema.ts                      (no dependency on tasks.repository.ts yet)
tasks.repository.ts → infra/database/database.module.ts, infra/database/schema (barrel), task.schema.ts (type-only)
infra/database/database.module.ts → infra/database/schema/index.ts
```

No circular imports. `infra/database/*` never imports from `tasks/*` — dependency direction (domain → infra) is respected structurally throughout.

## Healthy Boundaries

- **Clean one-directional layering.** Controller → Service → Repository → Drizzle connection, with no inversion-of-control violations found anywhere in the dependency graph.
- **`task.schema.ts` as a stable shared kernel.** `Task`/`TaskStatus`/`TaskResponseDto` are defined once and consumed by controller, service, repository, and all spec files — high fan-in on a rarely-changing contract is exactly the right shape.
- **Type-only imports at the repository boundary** (`import type { Task, TaskStatus }` in `tasks.repository.ts`) keep runtime coupling minimal even where type coupling is intentionally tight.
- **Repository reaches the DB schema through the barrel** (`infra/database/schema/index.ts`) rather than deep-importing, respecting the module's public surface.
- **Field-level vocabulary is identical end-to-end** — `title`, `description`, `status`, `createdAt` are named identically in the Postgres table, the domain Zod schema, the repository input types, and the spec's API shape. No translation layer needed anywhere.
- **The status-enum convention is already followed in spirit.** A hand-rolled `task.enum.ts` file was introduced and removed one commit later (`e8352b0` → `449b425`) in favor of deriving `TaskStatus` from the Zod schema — a good sign of fast course-correction on a known project convention.
- **`CreateTaskInput`/`UpdateTaskInput` (repository) vs. planned `CreateTaskDto`/`UpdateTaskDto` (API)** is intentional layering, not drift — persistence-shape types and wire-shape types are meant to diverge.

## Hotspots

No file in scope qualifies as high or medium risk by churn × complexity. All touched files are small (10–74 lines) with low nesting.

| Rank | File                                    | Changes (of 7 commits) | Complexity                               | Risk |
| ---- | --------------------------------------- | ---------------------- | ---------------------------------------- | ---- |
| 1    | `src/tasks/tasks.repository.ts`         | 3                      | Low (74 lines, 5 methods, max nesting 2) | Low  |
| 2    | `src/app.module.ts`                     | 3                      | Trivial (17 lines, declarative)          | Low  |
| 3    | `src/tasks/tasks.service.ts`            | 2                      | Trivial (15 lines)                       | Low  |
| 3    | `src/tasks/task.schema.ts`              | 2                      | Trivial (22 lines)                       | Low  |
| 3    | `src/infra/database/database.module.ts` | 2                      | Trivial (25 lines)                       | Low  |
| 3    | `src/tasks/tasks.module.ts`             | 2                      | Trivial (10 lines)                       | Low  |

`tasks.repository.ts` is the highest-churn file, but this reflects normal incremental feature build-out (CRUD methods added one at a time), not design distress. `tasks.repository.spec.ts` (413 lines) is the largest file in scope by far but low-churn — its length comes from thorough ZOMBIES-style test breadth (41 focused `it` blocks across 5 `describe` blocks), not tangled logic.

**Caveat**: with only 7 commits, "top 20% churn" is really just "the 1–2 files touched 3 times," not a meaningful percentile. Re-run this analysis once the repo has 20+ commits.

## Mismatches

### Vocabulary Drift

- **Minor/cosmetic**: `src/tasks/task.schema.ts` (domain Zod schema, singular) and `src/infra/database/schema/tasks.schema.ts` (Drizzle table schema, plural) have near-identical filenames despite living in different layers. No functional collision, but real risk of "which schema is this?" confusion when skimming imports or search results. **Recommendation**: rename the Drizzle-side file to something more distinguishing (e.g. `tasks.table.ts`) if this area grows further.

### Boundary Violations / Architecture Gaps

- **TasksService is not wired to TasksRepository.** `TasksService` still holds its own in-memory array (`private tasks: Task[] = []`) instead of delegating to the fully-built, fully-tested `TasksRepository`. `TasksRepository` is registered as a provider in `TasksModule` but has zero production consumers today — only its own spec exercises it. **Status: confirmed pending work, not a defect** — this is exactly what Slice 1 of `docs/specs/tasks-crud-api-spec.md` is scoped to fix, and the spec is already reviewed and ready to implement. No action needed from this assessment beyond noting it as the immediate next step.
- **Duplicated task-status literal list.** `'OPEN' | 'IN_PROGRESS' | 'DONE'` is hand-maintained in two places — the Zod enum (`task.schema.ts`) and the Drizzle `pgEnum` (`infra/database/schema/tasks.schema.ts`) — with no shared source. Both the coupling and behavioral analyses independently flagged this as a change amplifier: adding or renaming a status requires touching both files, and nothing enforces they stay in sync. Git history confirms they've already been edited independently (zero commit overlap between the two files). **Recommendation (confirmed): unify now.** Derive the Drizzle `pgEnum` from `TaskStatus.options` (e.g. `pgEnum('task_status', TaskStatus.options as [string, ...string[]])`) so there is one source of truth — consistent with the project's existing convention of deriving status literals from the Zod schema rather than hand-rolling them elsewhere. This is a quick win, no behavior change, best done before more statuses are added.

## Temporal Coupling

Given only 7 commits, no file pairing has enough occurrences to be statistically convincing. Noted for future tracking, not action:

- `tasks.repository.ts` ↔ `database.module.ts` co-occurred once (commit `ef73263`, "made repository injectable") — a legitimate structural dependency surfacing as expected coupling, not a concern.
- `package.json` ↔ `pnpm-lock.yaml` co-occurred in all 3 commits where either changed — expected, uninteresting.
- No shotgun-surgery pattern detected yet; re-run once the codebase has more history.

## Other Observations (not requiring action)

- Leftover Jest configuration (`package.json` `jest` block, `@types/jest`, `ts-jest`, `test:e2e` script) sits unused alongside the active Vitest setup — no `test/` directory or e2e specs exist. Candidate for removal if Jest-based e2e testing isn't planned.
- No CLAUDE.md exists in this repo; conventions are currently inferred from code and the SDD spec's Technical Context section.

## Validation Notes

- **Service/repository gap**: Confirmed as pending work tied to the already-reviewed SDD spec, not flagged as technical debt.
- **Status enum duplication**: Confirmed — recommend unifying now (derive Drizzle `pgEnum` from `TaskStatus.options`), called out as a quick win above.
- **File naming (`task.schema.ts` vs `tasks.schema.ts`)**: Confirmed as worth flagging — noted as a minor clarity suggestion above.

[x] Reviewed
