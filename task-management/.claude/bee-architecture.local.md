## Architecture Recommendation — Users + Task Assignee Mapping

**Pattern**: Simple/Layered (unchanged) — Controller → Service → Repository → Drizzle connection, replicated for Users exactly as it exists for Tasks. No ports/interfaces; single concrete repository implementation per module.

**Cross-module decision (developer-confirmed): Option 1 — Service-to-service.**
TasksModule imports UsersModule; UsersModule exports UsersService; TasksService injects UsersService and calls findById/exists before create/update when userId is provided, throwing BadRequestException if not found. DB-level FK (onDelete: 'set null') stays in place as a data-integrity backstop, not the primary validation path. Crosses the module boundary at the Service layer (matches "NotFoundException/BadRequestException thrown from service layer, not repository" convention). Dependency direction: TasksModule → UsersModule, TasksService → UsersService, one-way, matching the FK's data direction (tasks.userId → users.id). Users must never import from or know about Tasks.

**File structure**:
- src/users/user.schema.ts — CreateUserSchema (z.strictObject), User domain type, response schema with z.iso.datetime() for createdAt (mirrors task.schema.ts).
- src/users/users.repository.ts — injects DATABASE_CONNECTION; create, findAll, and findById (needed by Tasks' existence check in slice 2, not speculative).
- src/users/users.service.ts — thin orchestration; exposes findById/exists for cross-module use in addition to create/findAll.
- src/users/users.module.ts — providers: [UsersService, UsersRepository], exports: [UsersService] (this export is the whole boundary-crossing mechanism). UsersRepository stays private to the module.
- src/infra/database/schema/users.schema.ts — pgTable('users', ...) with a case-insensitive unique constraint on email (functional index on lowercased email), re-exported via the schema barrel.
- Modified for slice 2: src/tasks/task.schema.ts (add nullable userId), src/tasks/tasks.repository.ts (map userId in toTask, accept in CreateTaskInput/UpdateTaskInput), src/infra/database/schema/tasks.schema.ts (FK column with onDelete: 'set null'), src/tasks/tasks.module.ts (imports: [UsersModule]), src/tasks/tasks.service.ts (inject UsersService, validate userId before delegating to repository, throw BadRequestException if not found), src/app.module.ts (register UsersModule).

**Evolution Triggers**:
- Delete-user endpoint added later → check-then-write in TasksService becomes a real race condition; add a transaction or FK-violation catch as secondary defense then, not now.
- A third module needs to reference Users → extract a shared "assert user exists" helper at the third occurrence (DRY), not now.
- Users needs update/delete or richer rules (e.g. "assignee must be active") → those rules belong inside UsersService; no restructuring needed since Tasks already calls through the Service, not the Repository.
- Task-user relationship grows past a single nullable FK (many-to-many, roles, assignment history) → extract a dedicated assignment entity/repository.

**Slice Order**: No reorder needed. Slice 1 (Users: create + list) is a prerequisite for Slice 2 (Task-user mapping); each slice is independently releasable.
