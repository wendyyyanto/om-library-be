# om-library-be

The Organic Ministry library API. Accounts, profiles, and (in progress) book lending,
split out of `om-mobile-app-be` so the library owns its own service and deploy.

NestJS 11 + TypeORM + MySQL. **Node 20 or newer** — building on Node 14 fails inside
`@angular-devkit` with `SyntaxError: Unexpected token '??='`, which is a Node version
error, not a code error.

```bash
npm install
npm run build
npm start
```

Use `npm run start:dev` for watch mode and `npm run start:prod` after building.

## Endpoints

| Method | Route | Auth | Notes |
|---|---|---|---|
| `GET` | `/v1` | public | Health probe. |
| `POST` | `/v1/auth/register` | public | Self-signup. `role` is hardcoded to `member`. |
| `POST` | `/v1/auth/login` | public | bcrypt password, returns `{ user, accessToken }`. |
| `POST` | `/v1/auth/logout` | bearer | `204`, no body. Revokes by cutoff — see below. |
| `GET` | `/v1/profile` | bearer | The caller's own account. |
| `PATCH` | `/v1/profile` | bearer | `name` for anyone; `role`/`status` admin-only. |
| `POST` | `/v1/files` | bearer | Upload one `multipart/form-data` field named `file` to R2. |

## Environment

| Variable | Required | Default |
|---|---|---|
| `PORT` | no | `3000` |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | yes | — |
| `JWT_SECRET` | **yes** | none — the app refuses to start without it |
| `JWT_EXPIRES_IN` | no | `7d` |
| `BCRYPT_COST` | no | `12` |
| `R2_ACCOUNT_ID` | **yes** | — |
| `R2_ACCESS_KEY_ID` | **yes** | — |
| `R2_SECRET_ACCESS_KEY` | **yes** | — |
| `R2_BUCKET_NAME` | **yes** | — |
| `FILE_UPLOAD_MAX_BYTES` | no | `10485760` (10 MiB) |

The R2 credentials use an R2 API token's S3 access key id and secret access key, not a
general Cloudflare REST API bearer token. The app refuses to start if the required R2
configuration is incomplete.

## File uploads

`POST /v1/files` accepts exactly one in-memory multipart file in the `file` field. The
default 10 MiB limit is deliberately lower than R2's object limit because the API buffers
the upload before sending it to R2. Raise `FILE_UPLOAD_MAX_BYTES` only with the process's
available memory and expected concurrency in mind; large or resumable uploads should use
presigned or multipart uploads instead.

```bash
curl -X POST http://localhost:3000/v1/files \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@./cover.jpg"
```

The response contains the private R2 object key and upload metadata:

```json
{
  "key": "files/USER_ID/RANDOM_UUID.jpg",
  "etag": "OBJECT_ETAG",
  "size": 123456,
  "contentType": "image/jpeg",
  "originalName": "cover.jpg"
}
```

The service generates the object key; client filenames are never used as R2 paths. Objects
remain private unless access is added separately through a signed download URL or another
deliberate serving route.

## Database

Three tables: `library_users`, `library_roles`, `library_statuses`. `synchronize` is off,
so the service never alters schema at startup.

`library_users.tokens_valid_from` is required and is **not** created automatically:

```sql
ALTER TABLE `library_users`
  ADD COLUMN `tokens_valid_from` timestamp NOT NULL DEFAULT current_timestamp()
  AFTER `created_at`;
```

Existing rows get the `ALTER` timestamp, which invalidates every token issued before the
migration ran — one forced re-login.

`ROLE_IDS` and `USER_STATUS_IDS` in `constants/library.ts` hardcode the seeded reference-table
ids (`member`=1, `admin`=2; `active`=1, `inactive`=2). Rows must be seeded to match.

> This service currently points at the same MySQL database as `om-mobile-app-be`, which
> also still contains a copy of the auth layer. Splitting the data is a separate decision.

## Auth layer

`AuthModule` registers `JwtAuthGuard` as a global `APP_GUARD`, so **every route requires a
bearer token** unless it carries `@Public()`. Exactly three handlers are public, listed in
`ALLOWED_PUBLIC_ROUTES` in `commons/PublicRouteAudit.ts`: `GET /v1` (probes cannot send a
token), `POST /v1/auth/login` (locking it makes the API unreachable), and `POST
/v1/auth/register` (self-signup). `assertNoUnexpectedPublicRoutes()` runs at bootstrap and
**refuses to start** if any other route carries `@Public()` — so opening an endpoint is a
deliberate, reviewable edit to that allowlist rather than a one-line decorator.

`RolesGuard` is applied per controller with `@UseGuards(RolesGuard)` + `@Roles(...)`, not
globally. `CurrentUser()` is the only sanctioned source of the caller's identity.

`POST /auth/register` enforces uniqueness by the `email` index, not by the pre-`SELECT` —
that check only avoids paying for a bcrypt hash in the common "already registered" case.
`AuthService` maps errno 1062 to `EMAIL_TAKEN` itself rather than relying on the filter,
because the driver's index-name text differs between MariaDB (`for key 'email'`) and
MySQL 8 (`for key 'library_users.email'`).

### Logout without touching the token

`POST /auth/logout` revokes by moving a line: the handler writes
`library_users.tokens_valid_from = now`, and `JwtAuthGuard` rejects any token whose `iat`
falls before that with `401 SESSION_REVOKED`. The token in the client is left signed,
unexpired and byte-identical — it simply lands on the wrong side of the cutoff from the
next request onward. The user is taken from `CurrentUser()`, so a caller can only sign
themselves out.

Three details that are load-bearing rather than stylistic:

- **Only logout writes it** (and password change, once that endpoint exists). Login must not:
  writing it on login turns every sign-in into a global sign-out of the user's other devices.
  The register-time default is just a floor, not a meaningful event.
- **The cutoff comes from the app clock**, not SQL `NOW()`. `iat` is stamped by the app, so
  taking the cutoff from the database server's clock compares two clocks and lets a few
  seconds of skew carry tokens through the logout.
- **Both sides are compared in whole seconds.** `iat` has second resolution, so a
  millisecond-precision cutoff would outrank a token issued later in the same second and 401
  a fresh login. The trade is that a token issued in the same second as the logout survives it.

The guard costs one indexed `library_users` lookup per authenticated request. That is the
price of on-demand revocation; the alternative designs (a session table, a `jti` denylist)
cost a lookup too, plus unbounded rows.

## Errors

`MysqlExceptionFilter` is a global `APP_FILTER` scoped to TypeORM's `QueryFailedError`. It
maps driver errors to `{ statusCode, code, message }` (1062 to 409, 1451/1452 to 400,
1213/1205 to 503) so raw SQL text never reaches a client. Retries for deadlocks live in
`TransactionRunner`.

`createValidationPipe()` is a global `APP_PIPE` using `class-validator` DTOs from `src/dtos/`.
It runs with `whitelist` + `forbidNonWhitelisted`, so an unexpected body property is a 400
rather than a silently dropped field — which is what keeps `role` out of the register body.
Failures use the same `{ statusCode, code, message }` envelope with an added `errors` array.

## Not built yet

`constants/library.ts` already defines `LendingStatus`, `CopyStatus`, `DamageClaimStatus` and
the member tab filters, mirroring `library_lending`, `library_book_copies` and
`library_damage_claims`. There are **no entities, services or controllers for those tables
yet** — the constants are ahead of the endpoints. `GET /v1/lendings/me?tab=active|history` is
referenced in those comments but does not exist.

`TransactionRunner` is wired into `DatabaseModule` but currently has no caller. It is kept
because the lending flows will need retryable transactions.

## File layout and naming

One rule across `src/`: **the filename is the primary export, verbatim.** PascalCase, no
hyphens, no `.guard.ts` / `.dto.ts` style suffix — `AuthController.ts`, `LibraryUserEntity.ts`,
`AuthDto.ts`, `ProfileService.ts`, `AppModule.ts`, `JwtAuthGuard.ts`. The role is already in
the class name, so repeating it in the filename says it twice. Adding a file means naming it
after the thing it exports.

`src/constants/` is the one exception, and deliberately so: those are grouped value modules
with many peer exports and no single primary one (`library.ts` alone exports four enums and
five status lists), so they are named for the topic they cover, lowercase.

Cross-cutting request-pipeline pieces (guards, decorators, the exception filter, shared auth
types) live flat in `src/commons/` rather than one directory per kind. Split when it hurts:
once `commons/` passes ~12–15 files, or any single role reaches 4–5 members, give that role
its own directory.

Stateless helpers with no domain logic (`PasswordHasher`, `TransactionRunner`) live in
`src/utilities/`. These are named for what they do, not for a Nest role — they are injectable
but they are not services in the domain sense, so they carry no `Service` suffix. `Service`
means domain logic in `src/services/`.

There is deliberately no `src/types/` directory. A type lives with whatever owns it — the
module whose requirements dictate its shape — and consumers import it from there, however
many of them there are. `UserRole` lives in `constants/library.ts`; `AuthenticatedRequest`
lives in `commons/AuthTypes.ts` next to the guard that populates it. Reuse is not
homelessness. Promote a type to a shared location only when it is shape-only and domain-free
(`Paginated<T>`), when two modules want to change it in incompatible directions, or when a
real import cycle forces it. Never add a barrel `types/index.ts` — it hides ownership and
manufactures cycles.

Metadata keys stay in the same file as the decorator that writes them (`IS_PUBLIC_KEY` in
`Public.ts`, `ROLES_KEY` in `Roles.ts`). They look like constants, but a key and the decorator
that sets it are one unit; separating them is how a guard ends up reading a key nobody writes.
