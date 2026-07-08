## Architecture Recommendation — User Authentication

**Pattern**: Simple/Layered (Controller -> Service -> Repository -> Drizzle), confirmed — same pattern as src/tasks and src/users. No change.

**Start with**: AuthModule as a peer feature-folder to users/tasks, identical internal shape (controller/service/schema, no repository — AuthService delegates persistence to UsersService, owns no data of its own).

**File structure**:
```
src/auth/
  auth.module.ts          (new)
  auth.controller.ts      (new) + auth.controller.spec.ts
  auth.service.ts         (new) + auth.service.spec.ts
  auth.schema.ts          (new — RegisterSchema/LoginSchema, z.strictObject, 3-schema shape)
  auth.guard.ts           (existing — unchanged, do not touch)
  auth.guard.spec.ts      (existing — unchanged, 7 passing tests)
```
Modified in existing folders:
```
src/users/users.service.ts       — hash password in create(); add findByEmailWithPassword()
src/users/users.repository.ts    — add query for email lookup (no shape change to create())
src/users/users.controller.ts    — remove POST /users; GET /users untouched
src/tasks/tasks.module.ts        — imports: [UsersModule, AuthModule]
src/tasks/tasks.controller.ts    — @UseGuards(AuthGuard) at class level
src/tasks/tasks.controller.spec.ts — overrideGuard(AuthGuard) so existing tests keep passing
src/app.module.ts                — register AuthModule
.env / .env.example              — add JWT_SECRET
```

**Dependency graph** (verified, no cycle): TasksModule -> AuthModule -> UsersModule; TasksModule -> UsersModule directly too (harmless duplicate, Nest modules are singletons). UsersModule never imports AuthModule or TasksModule. AuthModule never imports TasksModule. No forwardRef needed.

`AuthModule` provides + exports `AuthGuard`. `TasksModule` imports `AuthModule` to make `AuthGuard` resolvable in its DI scope for `@UseGuards(AuthGuard)` — `TasksModule` does NOT need to separately import `JwtModule`; NestJS resolves `AuthGuard`'s own deps (`JwtService`, `UsersService`) within `AuthModule`'s own container.

**Key boundaries**:
- `AuthGuard` contract frozen (7 existing tests) — only its wiring changes, never its constructor/behavior.
- `JwtModule.registerAsync` (reading `ConfigService.getOrThrow<string>('JWT_SECRET')`) lives inside `AuthModule` only — mirrors `DatabaseModule`'s fail-fast `getOrThrow` pattern.
- `UsersService` is sole owner of password data (hashing on write via bcrypt, hash-inclusive read via new `findByEmailWithPassword`). `AuthService` never touches `UsersRepository` directly or does its own hashing/persistence — composes `UsersService` + `bcrypt.compare` + `JwtService.sign`.
- No interface/port abstraction for hashing or JWT signing — single concrete implementation of each, no foreseeable swap (YAGNI).

**Dependency direction**: TasksModule -> AuthModule -> UsersModule (one-way). AuthController -> AuthService -> UsersService (one-way, same layering as Tasks/Users).

## Evolution Triggers
- Second credential-lookup consumer beyond AuthService -> keep findByEmailWithPassword on UsersService, don't extract a repository interface yet; only extract if a second *data source* appears.
- Roles/permissions added later -> extend JWT payload and AuthGuard then; don't pre-build a permissions layer now.
- Second auth strategy (e.g. OAuth) -> that's when a passport strategy abstraction becomes warranted; today passport-jwt alone doesn't need one.
- UsersService accumulating both task-management and auth concerns beyond hashing-on-write/email lookup -> reconsider a dedicated sub-module, but not before it visibly happens.

## Slice Order
No reorder needed. Slice 1 (register + hashing) -> Slice 2 (login, depends on hashing) -> Slice 3 (guard protection, depends on real token) already dependency-correct.
