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
| `GET` | `/v1/teachings` | bearer | Paginated teaching list, newest first. |
| `POST` | `/v1/teachings` | bearer | Create a teaching owned by the caller. |
| `POST` | `/v1/files` | bearer | Upload one `multipart/form-data` field named `file` to R2. |
| `DELETE` | `/v1/files` | bearer | Delete the caller's uploaded file using `{ "file_id": "UUID" }`. |

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

## Teachings

`GET /v1/teachings` returns a paginated teaching list. `page` defaults to `1`; `limit`
defaults to `10` and accepts values from `1` through `50`. The endpoint selects only the
fields used by the list view and returns snake-case response keys:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Living by Faith",
      "category": "Topical Teaching",
      "teacher": "John Doe",
      "date": "2026-08-17T00:00:00.000Z",
      "uploaded_by": "66e76a86-9507-4b52-a2d6-f9bd7d58a68a"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_items": 42,
    "total_pages": 5
  }
}
```

Validation and other errors from this endpoint use `status_code` rather than
`statusCode`, keeping every response key in snake case.

```json
{
  "status_code": 400,
  "code": "VALIDATION_FAILED",
  "message": "Page must be a positive integer!",
  "errors": ["Page must be a positive integer!"]
}
```

`POST /v1/teachings` creates a teaching with `title`, `passage`, `chapters`, `category`,
`year`, `teacher` and `event` as required fields. At least one of `audio_url` or
`video_url` must be provided; the other media URL fields are optional and default to
`null`. `category` accepts `New Testament`,
`Old Testament`, `Topical Teaching` or `Workshop`. The server generates `id`, derives
`uploaded_by` from the authenticated caller and leaves both timestamps to MySQL; clients
cannot set those fields.

```json
{
  "title": "Living by Faith",
  "passage": "Romans 1:16-17",
  "chapters": "1",
  "category": "New Testament",
  "year": "2026",
  "teacher": "John Doe",
  "event": "Sunday Ministry",
  "audio_url": "https://example.com/audio.mp3",
  "video_url": null,
  "pdf_url": "https://example.com/notes.pdf",
  "ppt_url": null
}
```

A successful creation returns `201 Created` with the complete teaching in `data`, using
snake-case keys throughout.

If both `audio_url` and `video_url` are omitted, `null` or blank, the endpoint returns:

```json
{
  "status_code": 400,
  "code": "VALIDATION_FAILED",
  "message": "At least one of audio_url or video_url is required!",
  "errors": ["At least one of audio_url or video_url is required!"]
}
```

## File uploads

`POST /v1/files` accepts exactly one in-memory multipart file in the `file` field and an
optional `path` text field that selects the R2 key prefix. The path defaults to `files`.
The default 10 MiB limit is deliberately lower than R2's object limit because the API
buffers the upload before sending it to R2. Raise `FILE_UPLOAD_MAX_BYTES` only with the
process's available memory and expected concurrency in mind; large or resumable uploads
should use presigned or multipart uploads instead.

```bash
curl -X POST http://localhost:3000/v1/files \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@./cover.jpg" \
  -F "path=books/covers"
```

The response contains the public file id and upload metadata:

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "cover.jpg",
  "size": 123456,
  "contentType": "image/jpeg"
}
```

The service generates `fileId`, uses `{path}/{fileName}` as its internal R2 key and records
the object metadata in `library_files`. For the example above, the key is
`books/covers/cover.jpg`; no UUID directory is added. Upload uses R2's conditional object
creation, so another object with the same path and filename is never silently overwritten —
the API returns `409 FILE_ALREADY_EXISTS` instead. Leading, trailing and repeated forward
slashes in `path` are normalized; backslashes, control characters, `.` segments and `..`
segments are rejected. The original filename must be a single path component of at most 255
characters. Objects remain private unless access is added separately through a signed
download URL or another deliberate serving route.

Delete a file by sending the `fileId` returned by the upload endpoint. A user can delete
only a file whose `uploaded_by` value is their authenticated user id. Successful deletion
removes the R2 object, sets `deleted_at` on the metadata record and returns `204` with no
body. Repeating deletion for the same soft-deleted file also returns `204`.

```bash
curl -X DELETE http://localhost:3000/v1/files \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id":"550e8400-e29b-41d4-a716-446655440000"}'
```

## Database

Five tables: `library_users`, `library_roles`, `library_statuses`, `library_files`,
`teachings`.
`synchronize` is off, so the service never alters schema at startup. Create the file metadata
table before using the file endpoints:

```sql
CREATE TABLE `library_files` (
  `id` CHAR(36) NOT NULL,
  `uploaded_by` CHAR(36) NOT NULL,
  `storage_key` VARCHAR(255) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `content_type` VARCHAR(255) NOT NULL,
  `size_bytes` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_library_files_storage_key` (`storage_key`),
  KEY `idx_library_files_uploaded_by` (`uploaded_by`),

  CONSTRAINT `fk_library_files_uploaded_by`
    FOREIGN KEY (`uploaded_by`)
    REFERENCES `library_users` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

The database character set and collation for `library_files.uploaded_by` must be compatible
with `library_users.id` for MySQL to create the foreign key.

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
