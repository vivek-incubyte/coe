# Spec: User Authentication (backend only)

## Overview

Add email/password authentication to the task-management API: users register and log in through a new `AuthController`/`AuthService` (backed by the existing `UsersService`), passwords are hashed before storage, login issues a signed JWT, and the already-built `AuthGuard` is wired in to protect every task endpoint.

## Slice 1: Register a new account (walking skeleton — replaces the plaintext-storing `POST /users`)

The thinnest end-to-end path: an account can be created and its password is never stored in plaintext. `POST /users` is removed in favor of this new route, since registration now belongs to the Auth module by design.

- [x] `POST /auth/register` creates a new user account given `name`, `email`, and `password`, returning 201
- [x] A registered user's stored password is bcrypt-hashed — never stored in plaintext
- [x] Registration response includes `id`, `name`, `email`, and `createdAt`, and never includes the password or its hash
- [x] `POST /auth/register` returns 409 when the email is already registered (case-insensitive)
- [x] `POST /auth/register` returns 400 when `name`, `email`, or `password` is missing
- [x] `POST /auth/register` returns 400 when `password` is shorter than 5 characters or longer than 100 characters
- [x] `POST /users` no longer exists (removed; registration only happens via `POST /auth/register`)
- [x] `GET /users` continues to work exactly as before, unauthenticated — unaffected by this change

## Slice 2: Log in and receive an access token

Builds on Slice 1 — a registered user can now exchange their credentials for a JWT. Depends on hashing already existing so credentials can be verified.

- [x] `POST /auth/login` returns 200 with a signed JWT access token when `email` and `password` match a registered user
- [x] The issued JWT's payload contains the user's id as `sub` and their `email`
- [x] The issued JWT expires 1 hour after issuance
- [x] `POST /auth/login` returns 401 with a generic "invalid credentials" message when no user matches the given email
- [x] `POST /auth/login` returns 401 with the same generic "invalid credentials" message when the password does not match (identical message/status to the wrong-email case, so a caller cannot tell which was wrong)
- [x] Login response never includes the user's password or password hash

## Slice 3: Protect task endpoints with the existing AuthGuard

Builds on Slices 1-2 — a real, valid access token now exists to test against. Wires the already-implemented, already-tested `AuthGuard` (`src/auth/auth.guard.ts`, 7 passing tests, behavior unchanged) into the app for the first time.

- [x] `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` each return 401 when called without an `Authorization` header
- [x] Each task endpoint returns 401 when called with an invalid or expired token
- [x] Each task endpoint returns 401 when the token is valid but its subject no longer matches an existing user
- [x] Each task endpoint behaves exactly as it did before this feature (same success status and response shape) when called with a valid, current access token
- [x] A user can register, log in, and use the returned access token to successfully call a task endpoint, end-to-end
- [x] `GET /users` continues to work without a token, confirming Users endpoints are unaffected by task-endpoint guarding

## API Shape

```
POST /auth/register
{ name, email, password }
→ 201 { id, name, email, createdAt }
→ 400 when name/email/password missing, or password length invalid
→ 409 when email already registered (case-insensitive)

POST /auth/login
{ email, password }
→ 200 { accessToken }   // JWT, 1-hour expiry, payload { sub: userId, email }
→ 401 { message: "Invalid credentials" }   // identical for wrong email or wrong password

Protected task endpoints (all existing /tasks routes, unchanged request/response shape otherwise):
Authorization: Bearer <accessToken>
→ 401 when header missing, token invalid/expired, or token's user no longer exists
```

Note: `accessToken` is a best-judgment field name for the login response — flag for review if a different name is preferred.

## Out of Scope

- Refresh tokens or token renewal
- Password reset / forgot-password flow
- Email verification
- Roles, permissions, or admin/user distinctions — a valid token only proves "this is some registered user"
- Rate limiting or account lockout on repeated failed login attempts
- Logout, token revocation, or a token blacklist (JWT is stateless and simply expires after 1 hour)
- Guarding the Users endpoints (`GET /users` stays open and unauthenticated, per developer decision)
- Multi-factor authentication or social/OAuth login
- Changing password or updating account details after registration
- Server-side session storage beyond the JWT itself

## Technical Context

- Patterns to follow: Controller → Service → Repository layering, mirrored for `AuthController`/`AuthService` in `src/auth/`. `ZodValidationPipe` applied per-parameter with new `RegisterSchema`/`LoginSchema` (`z.strictObject`, following `CreateUserSchema`'s style).
- `AuthGuard` (`src/auth/auth.guard.ts`) is already implemented and fully tested (7 passing tests in `auth.guard.spec.ts`) — this feature does not change its constructor or behavior contract, only wires it in: register `AuthModule`/`JwtModule` in `TasksModule`'s imports so `AuthGuard`'s `JwtService` dependency resolves, then apply `@UseGuards(AuthGuard)` at the `TasksController` class level.
- New `AuthModule` registers `JwtModule` via `JwtModule.registerAsync`, reading the secret with `ConfigService.getOrThrow<string>('JWT_SECRET')` (fail-fast, matching `DatabaseModule`'s existing pattern) and `signOptions: { expiresIn: '1h' }`. Add `JWT_SECRET` to `.env` and `.env.example`.
- Bcrypt hashing is added inside `UsersService.create()` so every user-creation path is safe by construction — `CreateUserSchema`/`CreateUserDto` and `UsersRepository.create()` need no shape changes, they already accept a plain `password` string; `UsersService` now hashes it before delegating to the repository.
- `AuthService.register()` delegates to `UsersService.create()` (per the developer's original design intent: Auth takes `UsersService` as a dependency and uses it in the route) rather than duplicating persistence logic.
- `AuthService.login()` needs a way to look up a user by email with their password hash included — `UsersService`/`UsersRepository` currently only expose `findById`/`findAll` (both return `PublicUser`, password stripped), so a new lookup (e.g. `findByEmailWithPassword`) is needed for credential verification. Compare with `bcrypt.compare()`, then sign a JWT with `JwtService.sign()`.
- Reuse the existing `AuthToken` type from `auth.guard.ts` (`{ sub, email }`) as the JWT payload shape when signing — don't redefine it.
- `tasks.controller.spec.ts` and any Nest `Test.createTestingModule`-based specs for `TasksController` will need `AuthGuard` mocked or overridden (`overrideGuard`) once the guard is applied — flag for the TDD planner so existing task tests keep passing.
- Test coverage: mock `bcrypt` and `JwtService` in `auth.service.spec.ts` per the existing GOoS mocking style used in `auth.guard.spec.ts`. The full register → login → access-protected-endpoint → rejected-without/bad-token flow should be covered by an integration-level spec following the existing real-Postgres serialized pattern (`TEST_DATABASE_URL`, `migrate()`, truncate-before-each) used by `users.repository.spec.ts`.
- Status literals / DTOs: no hand-rolled enums; auth schemas follow the existing three-schema shape used elsewhere (`user.schema.ts`) where applicable.
- Risk level: HIGH
