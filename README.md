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

| Method   | Route               | Auth   | Notes                                                            |
| -------- | ------------------- | ------ | ---------------------------------------------------------------- |
| `GET`    | `/v1`               | public | Health probe.                                                    |
| `POST`   | `/v1/auth/register` | public | Self-signup. `role` is hardcoded to `member`.                    |
| `POST`   | `/v1/auth/login`    | public | bcrypt password, returns `{ user, accessToken, refreshToken }`.  |
| `POST`   | `/v1/auth/refresh`  | public | Rotates a refresh token and returns a new token pair.            |
| `POST`   | `/v1/auth/logout`   | bearer | `204`, no body. Revokes by cutoff — see below.                   |
| `GET`    | `/v1/profile`       | bearer | The caller's own account.                                        |
| `PATCH`  | `/v1/profile`       | bearer | `name` for anyone; `role`/`status` admin-only.                   |
| `GET`    | `/v1/teachings`     | bearer | Paginated teaching list, newest first.                           |
| `GET`    | `/v1/teachings/:id` | bearer | Teaching detail with file metadata.                              |
| `POST`   | `/v1/teachings`     | bearer | Create a teaching owned by the caller.                           |
| `DELETE` | `/v1/teachings/:id` | bearer | Hard-delete an owned teaching and its unshared files.            |
| `POST`   | `/v1/files`         | bearer | Upload one `multipart/form-data` field named `file` to R2.       |
| `DELETE` | `/v1/files`         | bearer | Delete the caller's uploaded file using `{ "file_id": "UUID" }`. |

## Environment

| Variable                                          | Required | Default                                    |
| ------------------------------------------------- | -------- | ------------------------------------------ |
| `PORT`                                            | no       | `3000`                                     |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | yes      | —                                          |
| `JWT_SECRET`                                      | **yes**  | none — the app refuses to start without it |
| `JWT_EXPIRES_IN`                                  | no       | `30m`                                      |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS`                   | no       | `30`                                       |
| `BCRYPT_COST`                                     | no       | `12`                                       |
| `CLOUDFLARE_ACCOUNT_ID`                           | **yes**  | —                                          |
| `R2_ACCESS_KEY_ID`                                | **yes**  | —                                          |
| `R2_SECRET_ACCESS_KEY`                            | **yes**  | —                                          |
| `R2_BUCKET_NAME`                                  | **yes**  | —                                          |
| `FILE_UPLOAD_MAX_BYTES`                           | no       | `10485760` (10 MiB)                        |

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

`GET /v1/teachings/:id` returns the complete teaching and resolves its active audio, PDF
and presentation file relations. Related file metadata is grouped into separate objects;
internal storage keys and file ownership are not exposed:

```json
{
	"data": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"title": "Living by Faith",
		"passage": "Romans 1:16-17",
		"chapters": "1",
		"category": "Topical Teaching",
		"year": "2026",
		"teacher": "John Doe",
		"event": "Sunday Ministry",
		"audio_file": {
			"id": "319b925f-48c6-4e4d-9ee7-a114eacf0b63",
			"file_name": "living-by-faith.mp3",
			"content_type": "audio/mpeg",
			"size_bytes": 8542130,
			"url": "https://cdn.example.com/teachings/living-by-faith.mp3"
		},
		"video_url": null,
		"pdf_file": {
			"id": "c96d934f-2154-4fea-bf0d-a97f519863f7",
			"file_name": "living-by-faith.pdf",
			"content_type": "application/pdf",
			"size_bytes": 532100,
			"url": "https://cdn.example.com/teachings/living-by-faith.pdf"
		},
		"ppt_file": null,
		"created_at": "2026-08-17T00:00:00.000Z",
		"updated_at": "2026-08-17T00:00:00.000Z",
		"uploaded_by": "66e76a86-9507-4b52-a2d6-f9bd7d58a68a"
	}
}
```

A missing related file is returned as `null`. A file whose `url` has not been populated is
returned with `url: null`. Invalid teaching ids return
`400 VALIDATION_FAILED`; valid ids with no matching teaching return:

```json
{
	"status_code": 404,
	"code": "NOT_FOUND",
	"message": "Teaching not found."
}
```

`POST /v1/teachings` creates a teaching with `title`, `passage`, `chapters`, `category`,
`year`, `teacher` and `event` as required fields. At least one of `audio_file_id` or
`video_url` must be provided. `audio_file_id`, `pdf_file_id` and `ppt_file_id` reference
previously uploaded library files and default to `null`. `category` accepts `New Testament`,
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
	"audio_file_id": "319b925f-48c6-4e4d-9ee7-a114eacf0b63",
	"video_url": null,
	"pdf_file_id": "c96d934f-2154-4fea-bf0d-a97f519863f7",
	"ppt_file_id": null
}
```

A successful creation returns `201 Created` with the complete teaching in `data`, using
snake-case keys throughout.

If both `audio_file_id` and `video_url` are omitted, `null` or blank, the endpoint returns:

```json
{
	"status_code": 400,
	"code": "VALIDATION_FAILED",
	"message": "At least one of audio_file_id or video_url is required!",
	"errors": ["At least one of audio_file_id or video_url is required!"]
}
```

`DELETE /v1/teachings/:id` hard-deletes a teaching owned by the authenticated caller. The
service obtains the audio, PDF and presentation storage keys from `library_files`; clients
must not send storage keys. Duplicate file ids across those three fields are processed once.
For every attached file, the service deletes the R2 object and hard-deletes the corresponding
`library_files` row. `video_url` is external metadata and is not deleted.

```bash
curl -X DELETE http://localhost:3000/v1/teachings/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Success returns `204` with no body. A valid but missing teaching returns `404`; a teaching
owned by another user returns `403`. Deletion returns `409 INVALID_STATE` without changing
anything when an attached file is owned by another user, missing, or referenced from any file
column of another teaching. An R2 failure returns `502 FILE_DELETE_FAILED`.

R2 and MySQL cannot share one atomic transaction. The endpoint deletes R2 objects before
committing its database deletes, so a later database failure can leave an object absent while
its metadata remains. A durable deletion outbox with retries is required if guaranteed
cross-system recovery becomes a requirement.

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
`books/covers/cover.jpg`; no UUID directory is added. The `url` column receives the public
asset URL at `https://assets.organic-ministry.org/{storage_key}` with each path segment URL
encoded while preserving `/` separators. Upload uses R2's conditional object creation, so
another object with the same path and filename is never silently overwritten — the API
returns `409 FILE_ALREADY_EXISTS` instead. Leading, trailing and repeated forward slashes in
`path` are normalized; backslashes, control characters, `.` segments and `..` segments are
rejected. The original filename must be a single path component of at most 255 characters.

Delete a file by sending the `fileId` returned by the upload endpoint. A user can delete
only a file whose `uploaded_by` value is their authenticated user id. Successful deletion
removes the R2 object, hard-deletes the metadata record and returns `204` with no body.
Deletion returns `409 INVALID_STATE` while any teaching references the file. Repeating a
successful deletion returns `404` because no tombstone record is retained.

```bash
curl -X DELETE http://localhost:3000/v1/files \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id":"550e8400-e29b-41d4-a716-446655440000"}'
```

## Database

Six tables: `library_users`, `library_auth_sessions`, `library_roles`,
`library_statuses`, `library_files`, `teachings`.
`synchronize` is off, so the service never alters schema at startup. Create the file metadata
table before using the file endpoints:

```sql
CREATE TABLE `library_files` (
  `id` CHAR(36) NOT NULL,
  `uploaded_by` CHAR(36) NOT NULL,
  `storage_key` VARCHAR(255) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `url` TEXT NULL,
  `content_type` VARCHAR(255) NOT NULL,
  `size_bytes` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

Existing deployments must remove the former soft-delete column after deploying application
code that no longer reads or writes it:

```sql
ALTER TABLE `library_files` DROP COLUMN `deleted_at`;
```

This schema change is destructive. Back up the database or verify a rollback plan first, and
do not run it while an older application instance that still queries `deleted_at` is active.

`library_users.tokens_valid_from` is required and is **not** created automatically:

```sql
ALTER TABLE `library_users`
  ADD COLUMN `tokens_valid_from` timestamp NOT NULL DEFAULT current_timestamp()
  AFTER `created_at`;
```

Existing rows get the `ALTER` timestamp, which invalidates every token issued before the
migration ran — one forced re-login.

Refresh-token rotation requires the session table below. Create it before deploying the
refresh-enabled application code because `synchronize` is disabled:

```sql
CREATE TABLE `library_auth_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `refresh_token_hash` BINARY(32) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,

  PRIMARY KEY (`id`),
  KEY `idx_library_auth_sessions_user_id` (`user_id`),

  CONSTRAINT `fk_library_auth_sessions_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `library_users` (`id`)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

The table stores only the SHA-256 hash of each 256-bit refresh-token secret. One row is one
device session. Rotation replaces the hash and extends `expires_at`; presenting an older
token deletes that session. The table's `user_id` character set and collation must match
`library_users.id`.

`ROLE_IDS` and `USER_STATUS_IDS` in `constants/library.ts` hardcode the seeded reference-table
ids (`member`=1, `admin`=2; `active`=1, `inactive`=2). Rows must be seeded to match.

> This service currently points at the same MySQL database as `om-mobile-app-be`, which
> also still contains a copy of the auth layer. Splitting the data is a separate decision.

## Auth layer

`AuthModule` registers `JwtAuthGuard` as a global `APP_GUARD`, so **every route requires a
bearer token** unless it carries `@Public()`. Exactly four handlers are public, listed in
`ALLOWED_PUBLIC_ROUTES` in `commons/PublicRouteAudit.ts`: `GET /v1` (probes cannot send a
token), `POST /v1/auth/login` (locking it makes the API unreachable), `POST
/v1/auth/register` (self-signup), and `POST /v1/auth/refresh` (access tokens may already be
expired when it is called). `assertNoUnexpectedPublicRoutes()` runs at bootstrap and
**refuses to start** if any other route carries `@Public()` — so opening an endpoint is a
deliberate, reviewable edit to that allowlist rather than a one-line decorator.

`RolesGuard` is applied per controller with `@UseGuards(RolesGuard)` + `@Roles(...)`, not
globally. `CurrentUser()` is the only sanctioned source of the caller's identity.

`POST /auth/register` enforces uniqueness by the `email` index, not by the pre-`SELECT` —
that check only avoids paying for a bcrypt hash in the common "already registered" case.
`AuthService` maps errno 1062 to `EMAIL_TAKEN` itself rather than relying on the filter,
because the driver's index-name text differs between MariaDB (`for key 'email'`) and
MySQL 8 (`for key 'library_users.email'`).

`POST /v1/auth/refresh` accepts `{ "refreshToken": "<session-id>.<secret>" }`. A successful
call atomically replaces the stored secret hash and returns a new `{ accessToken,
refreshToken }` pair. The submitted refresh token cannot be used again. Mobile clients must
serialize refresh requests so two concurrent requests do not reuse the same token.

### Logout without touching the token

`POST /auth/logout` revokes by moving a line: the handler writes
`library_users.tokens_valid_from = now`, and `JwtAuthGuard` rejects any token whose `iat`
falls before that with `401 SESSION_REVOKED`. The token in the client is left signed,
unexpired and byte-identical — it simply lands on the wrong side of the cutoff from the
next request onward. Logout also deletes all of the user's refresh sessions. The user is
taken from `CurrentUser()`, so a caller can only sign themselves out.

Three details that are load-bearing rather than stylistic:

- **Logout and privilege/status changes write it** (as will password change, once that
  endpoint exists). Login must not: writing it on login turns every sign-in into a global
  sign-out of the user's other devices. The register-time default is just a floor, not a
  meaningful event.
- **The cutoff comes from the app clock**, not SQL `NOW()`. `iat` is stamped by the app, so
  taking the cutoff from the database server's clock compares two clocks and lets a few
  seconds of skew carry tokens through the logout.
- **Both sides are compared in whole seconds.** `iat` has second resolution, so a
  millisecond-precision cutoff would outrank a token issued later in the same second and 401
  a fresh login. The trade is that a token issued in the same second as the logout survives it.

The guard checks `library_users.tokens_valid_from` and the bounded session row named by the
JWT's `sid`. Access tokens issued before refresh support have no `sid`, so deploying this
change intentionally requires one login to establish the user's first refresh session.

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
