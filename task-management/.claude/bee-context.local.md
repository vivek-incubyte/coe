## Grill-Me / Clarification Decisions
- Auth registration/login should live behind an Auth module/controller that takes UsersService as a dependency and uses it in the route (developer's own words) — build AuthController/AuthService in src/auth depending on UsersService, not bolt registration onto UsersController.
- JWT expiry: 1 hour.
- AuthGuard protects ALL task endpoints (GET/POST/PATCH/DELETE).

## Context Gatherer Output

### Project Structure
Stack: TypeScript, NestJS 11, Drizzle ORM + Postgres, Zod v4. Feature-module folders: src/tasks, src/users, src/auth (guard only, no module yet), src/infra/database, src/common/pipes. Deps @nestjs/jwt, @nestjs/passport, passport, passport-jwt, bcrypt (+types) installed but unused in src/ yet. ConfigModule global via ConfigModule.forRoot({isGlobal:true}).

### Architecture Pattern
Simple layered: Controller -> Service -> Repository -> Drizzle, one dir per domain. TasksModule imports UsersModule. AuthGuard already depends on JwtService + UsersService via constructor DI (same style) but not registered in any module/app.module.ts yet. Dependency direction consistently inward, no violations.

### Test Infrastructure
Vitest, co-located *.spec.ts. users.repository.spec.ts is real-DB integration spec (TEST_DATABASE_URL, migrate() in beforeAll, truncate in beforeEach, close in afterAll). vitest.config.ts sets fileParallelism:false because integration specs share one real Postgres DB. users.service.spec.ts / users.controller.spec.ts are pure-mock unit specs (vi.fn(), Test.createTestingModule, {provide:X,useValue:mock}). Any new integration spec must follow the serialized pattern.

### Conventions
- Status/enum-like literals derived from Zod schemas, never hand-rolled enum files (project already removed a task.enum.ts in favor of z.enum derived from schema).
- DTO shape per resource: full *Schema (includes password), Create*Schema (z.strictObject, rejects extra fields), *ResponseSchema/*ResponseDto (public-safe, ISO date strings). New auth schemas (Login/Register) should follow this same three-schema shape.
- PublicUser = Omit<User,'password'> already exists and is what Users layer returns everywhere except create() input — never let a password/hash leave the repository layer in a response.
- ZodValidationPipe applied per-parameter (@Body(new ZodValidationPipe(Schema))), not globally — new auth endpoints use the same pipe.
- Controllers stay thin, map to response DTO via private toResponseDto, no business logic in controllers.
- Errors: domain-specific Nest exceptions thrown from service layer (ConflictException, NotFoundException), Postgres code 23505 checked for uniqueness violations, other errors rethrown unchanged.
- Tests use ZOMBIES-style case coverage implicitly via describe/it naming — NEVER letter-comment headers (// Z:, // O: etc.) per user's standing rule.

### Change Area — Current State
- src/auth/auth.guard.ts + auth.guard.spec.ts: fully implemented GOoS-mock-style guard (mocks JwtService + UsersService), checks Bearer header, jwtService.verifyAsync<AuthToken>, then userService.findById(sub), attaches request.user, returns boolean. 7 existing tests MUST keep passing unchanged — do not change constructor signature or behavior contract, only wire it into a module.
- src/users/user.schema.ts: UserSchema has password: z.string() (no hash format validation at schema level — hashing happens in service, not schema). CreateUserSchema already enforces min(5).max(100) on password.
- src/users/users.service.ts create(): passes createUserDto straight to repository — PASSWORD STORED PLAINTEXT TODAY. This is the exact spot needing bcrypt hashing before persistence (or a new AuthService.register() step before delegating to UsersService — TBD in spec, developer wants Auth layer to depend on UsersService for this).
- src/users/users.repository.ts create(): accepts plain {name,email,password}, inserts as-is — repository is hash-agnostic, no change needed regardless of where hashing happens.
- src/users/users.controller.ts: POST /users (create, unauthenticated) and GET /users (list, unauthenticated) exist today — no login endpoint. Whether POST /users stays, is guarded, or moves to /auth/register needs settling in spec.
- src/tasks/tasks.controller.ts: all 5 routes (GET, GET:id, POST, PATCH:id, DELETE:id) have zero auth guards today. TasksModule already imports UsersModule; will also need to import AuthModule (or JwtModule) so AuthGuard can resolve JwtService in that module's DI scope.
- No AuthModule, no JwtModule.register/forRootAsync call anywhere. No JWT_SECRET in .env/.env.example yet — add via JwtModule.registerAsync reading ConfigService, following DatabaseModule's ConfigService.getOrThrow<string>('DATABASE_URL') fail-fast pattern (use getOrThrow for JWT secret too, not a silent default).

### Best-guess files to add/modify (confirm in spec)
- .env / .env.example: add JWT_SECRET
- New: src/auth/auth.module.ts, src/auth/auth.service.ts (+spec), src/auth/auth.controller.ts (+spec), src/auth/auth.schema.ts (Login/Register Zod schemas, 3-schema pattern)
- src/users/users.service.ts: add bcrypt hashing in create() (or coordinate with new AuthService.register(), per spec decision)
- src/app.module.ts: register AuthModule
- src/tasks/tasks.module.ts: import AuthModule (or JwtModule) for AuthGuard DI
- src/tasks/tasks.controller.ts: add @UseGuards(AuthGuard) class-level, protecting all 5 routes
- src/users/users.controller.ts: resolve whether POST /users stays/guarded/moves

### Existing Documentation
docs/specs/tasks-crud-api-spec.md's Out of Scope explicitly states "Authentication/authorization (single-tenant, unauthenticated API)" — this new auth spec is the first to introduce it; call out in new spec that all existing endpoints being newly protected is a deliberate scope expansion.

### Tidy Opportunities
Plaintext password storage is a live security gap fixed AS PART OF this feature, not a separate tidy commit. No dead code, no skipped/broken tests, no functions over 50 lines in auth/users/tasks area — otherwise clean, no separate tidy pass needed.

### Design System
UI-involved: no. Backend-only NestJS API.
