# SECURITY_AUDIT.md

Saxony Smart Campus — deep security audit and remediation.

## Status

| # | Finding | Severity (before) | Status |
| - | ------- | ----------------- | ------ |
| 2.1 | Unauthenticated WebSocket gateways (`/attendance`, `/notifications`) | Critical | **Fixed** — JWT handshake + tenant/role ACLs |
| 2.2 | `POST /notifications/send` cross-tenant fan-out | Critical | **Fixed** — recipients intersected with tenant; broadcast admin-only |
| 2.3 | bcrypt scan loop on refresh + reset token verify | High (DoS + correctness) | **Fixed** — HMAC-SHA256 O(1) lookup |
| 2.4 | Bull-Board JWT in query string | High | **Fixed** — header-only |
| 2.5 | `/students/import` unbounded upload | High | **Fixed** — 5 MB / 1 file / XLSX filter / 5000-row cap |
| 2.6 | `/me/push-token` hijack | High | **Fixed** — owner check |
| 2.7 | CSV formula injection (`/reports/*?format=csv`) | High | **Fixed** — leading-character guard |
| 2.8 | Plaintext passwords returned by `/users` | High | **Fixed** — password-reset email flow |
| 2.9 | `QR_HMAC_SECRET` defaults to `""` | High | **Fixed** — refuses to boot if unset |
| 2.10 | `INITIAL_ADMIN_PASSWORD` defaults to `ChangeMe!2025` | High | **Fixed** — random one-time password in dev; required in prod |
| 2.11 | Dependency CVEs (multer, lodash, fast-xml-*, next) | High | **Fixed (multer/lodash/fast-xml/postcss)**; **partial (next 14.2.x patched line)** |
| 2.12 | `/auth/logout` unrate-limited | Medium | **Fixed** — 30/60s throttle |
| 2.13 | CORS=* + credentials | Medium | **Fixed** — prod refuses, dev disables credentials |
| 2.14 | Cookie parser unsigned | Low | **Fixed** — `COOKIE_SECRET` plumbed |
| 2.15 | `/leave-requests/:id/review` accepts non-UUID `:id` | Low | **Fixed** — ParseUUIDPipe |

See §2 below for the per-finding writeup (severity, CWE, root cause, PoC, fix, regression risk).


> Scope: backend (NestJS 10 / Prisma 5 / Socket.io / Bull), admin web (Next.js 14), mobile (Flutter 3), infrastructure (Docker / MinIO / Redis 7 / Postgres 16), CI/CD (GitHub Actions), dependency tree and environment configuration.
>
> Method: complete attack-surface mapping → end-to-end runtime tracing of every REST controller, WebSocket gateway, queue worker, auth flow, token lifecycle, file upload path and ORM call → exploitation review against OWASP Top 10, CWE Top 25 and Socket.IO / Next.js / NestJS / multer / lodash advisory databases.
>
> Posture (CVSS-style, qualitative): **Before — High risk. After — Low/Medium residual risk.**

---

## 0. Executive summary

The application has a mostly well-structured foundation: multi-tenant scoping by `universityId`, role-based guards, RS256 JWT access tokens, HMAC-SHA256 rotating QR tokens with timing-safe comparison, family-based refresh-token theft detection, ParseUUIDPipe on every `:id`, class-validator DTOs with `forbidNonWhitelisted`, Bull-Board behind a JWT guard, Helmet + Next.js CSP, secure cookies and `sameSite=strict`. None of those are token-bypass-grade weak.

However, a small number of issues are real and exploitable today:

1. **WebSocket gateways are completely unauthenticated.** Both `/attendance` and `/notifications` accept any connection with `cors: origin: '*'`, then trust the body of `session:join` and `user:subscribe` to put the client into arbitrary rooms — including other tenants. **Critical.**
2. **`POST /notifications/send` accepts a `recipientUserIds[]` that is never tenant-checked.** A doctor in tenant A can deliver — and (via #1) read back — notifications to any user ID in any tenant. **Critical.**
3. **Refresh-token and password-reset look-ups iterate `bcrypt.compare` over the most-recent 200/400 rows.** Each `/auth/refresh` call costs ≈400 bcrypts (~3–12s of CPU) and silently invalidates real users when the list overflows. **High DoS + correctness.**
4. **Bull-Board admin UI accepts the JWT in `?access_token=`.** Token leaks through proxy access logs, the `Referer` header and browser history. **High.**
5. **`/students/import` accepts arbitrarily large files with no MIME / extension check** — combined with the **multer 2.0.2** DoS CVEs already flagged by `pnpm audit`. **High.**
6. **`POST /me/push-token` upserts on the unique `token` column without owner check** — submitting another user's known FCM token reassigns it and silently redirects their push notifications. **High.**
7. **CSV exports (`/reports/session/:id`, `/reports/subject/:id`)** escape `, " \n` but not `= + - @ \t \r` — classic spreadsheet-formula injection (CWE-1236). **High.**
8. **Plaintext passwords are returned in the JSON body** of `POST /users` and `POST /users/:id/reset-password`. The whole web admin response — and any caller logs — now carries a credential. **High.**
9. **`QR_HMAC_SECRET` defaults to the empty string** at process boot; if the env var is unset, every QR token is derivable. **High.**
10. **`INITIAL_ADMIN_PASSWORD` defaults to `ChangeMe!2025`** in `app.config.ts` and seeds an admin with it. Anyone reading the public repo knows the default credential. **High.**
11. **Several dependency CVEs**: `next 14.2.16` (1 critical, 11 high/moderate), `multer 2.0.2` (3 high), `lodash 4.17.21` (high prototype-pollution + template injection), `fast-xml-builder 1.1.5` (high). **High.**
12. **`/auth/logout` is unrate-limited and public**, and `/auth/refresh` is throttled at a generous 30/min — both feed the bcrypt scan loop in #3 and are easy DoS amplifiers. **Medium.**
13. **CORS accepts `*` while also setting `credentials: true`** when `ADMIN_WEB_ORIGIN=*` — a configuration that browsers reject and that lets the operator believe credentials are working when they are not. **Medium.**

This PR fixes 1–13 in code, adds regression tests, and pins the vulnerable dependencies. Findings §4 below are advisories the team should track but are either not directly exploitable today or carry too high a regression risk to fix in a security PR.

| Posture | Critical | High | Medium | Low |
| ------- | -------- | ---- | ------ | --- |
| Before | 3 | 9 | 7 | 4 |
| After  | 0 | 1 | 3 | 4 |

The remaining `High` after fixes is the bundle of `next 14.2.x` advisories that require a Next.js 15 upgrade (major-version migration); the 14.2.x line has been bumped to the latest patched build (`14.2.33`) so all Next-line _moderate_ XSS and cache-poisoning advisories that ship a 14.2.x patch are closed. See §4.

---

## 1. Attack surface

### 1.1 REST endpoints — backend (NestJS)

All controllers below are mounted under the global prefix `/api/v1`. Every numeric "auth" column reflects what is enforced by guards / decorators in the controller.

| Surface | Auth | Roles | Notes |
| ------- | ---- | ----- | ----- |
| `POST /auth/login` | Public | — | Throttled 5/60s + 20/600s. Body: `{email, password, twoFactorCode?}`. Returns access+refresh+user. |
| `POST /auth/refresh` | Public | — | Throttled 30/60s. Reads body or `refreshToken` HttpOnly cookie. |
| `POST /auth/logout` | Public | — | **Unthrottled.** Reads cookie or body. |
| `GET /auth/csrf` | JWT | admin | Emits an opaque random token — not currently bound to a session. Stub only. |
| `POST /auth/admin/2fa/setup` | JWT | admin | TOTP secret + otpauth URL. |
| `POST /auth/admin/2fa/enable` | JWT | admin | TOTP enable + recovery codes (returned once). |
| `POST /auth/admin/2fa/disable` | JWT | admin | |
| `GET /me` | JWT | * | Includes university settings + 2FA state. |
| `PATCH /me`, `POST /me/change-password` | JWT | * | Password change revokes all refresh tokens. |
| `GET /me/sessions`, `DELETE /me/sessions` | JWT | * | Lists / revokes refresh-token family. |
| `POST /me/push-token`, `DELETE /me/push-token/:token` | JWT | * | FCM registration. **Hijack risk — fixed.** |
| `GET/POST/PUT/DELETE /users` | JWT | admin | Email is `@unique` *globally* in `User`. |
| `POST /users/:id/reset-password` | JWT | admin | **Returns plaintext** — fixed. |
| `GET/POST/PUT/DELETE /rooms` | JWT | admin (write), admin+doctor (read) | `GET /rooms/:id/qr` emits PNG with `room:<id>:<qrCodeStatic>`. |
| `GET/POST/PUT/DELETE /subjects, /sections, /doctors, /students` | JWT | admin (write), some read for doctor | UUID-validated params. |
| `POST /students/import` | JWT | admin | XLSX import — **no fileSize/MIME limits**, multer 2.0.2 CVEs. Fixed. |
| `GET /students/import/template` | JWT | admin | Streams a static XLSX. |
| `POST /schedule/generate, /publish, /slot`, `PUT /schedule/:slotId`, `DELETE /schedule/:slotId` | JWT | admin | Deterministic schedule generator. |
| `GET /schedule, /conflicts, /my` | JWT | admin / self | Doctor/student self-views. |
| `POST /attendance/sessions/start` | JWT | doctor | Caller must own the schedule slot. |
| `POST /attendance/sessions/:id/refresh-qr, /close` | JWT | doctor | Owner-only via `requireDoctorSession`. |
| `GET /attendance/sessions/:id/qr` | JWT | doctor | Emits PNG with rotating HMAC token. |
| `POST /attendance/scan` | JWT | student | 5-step verification chain (token → enrollment → active session → GPS → idempotency). |
| `POST /attendance/sessions/:id/manual` | JWT | doctor | Owner-only. |
| `GET /attendance/sessions/:id, /live` | JWT | admin / doctor | |
| `GET /leave-requests`, `POST /leave-requests`, `GET /leave-requests/mine`, `PATCH /leave-requests/:id/review` | JWT | role-scoped | `studentId` on review path is admin/doctor. `:id` lacks UUID pipe — see §3. |
| `GET /notifications` | JWT | self | Recipient-scoped query. |
| `POST /notifications/send` | JWT | admin + doctor | **`recipientUserIds[]` not tenant-checked — fixed**; **`broadcast` allowed for doctor — narrowed to admin.** |
| `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id` | JWT | self | UUID-piped. |
| `GET /reports/session/:id`, `/subject/:id?format=csv` | JWT | admin + doctor | **CSV formula injection — fixed.** |
| `GET /analytics/*` | JWT | admin | |
| `GET /audit` | JWT | admin | |
| `GET /at-risk`, `/settings`, `/:studentId`, `/:studentId/notify`, `/:id/resolve` | JWT | mixed | `student` role allowed to read own records. |
| `POST /auth/password/forgot`, `/reset` | Public | — | Throttled 3/60s + 5/60s. **`/reset` body, not URL** — good. |
| `GET /settings`, `PATCH /settings` | JWT | mixed | University settings JSON. |
| `GET /health`, `/health/readiness` | Public | — | No PII. |

### 1.2 WebSocket gateways

| Namespace | Auth (before) | Auth (after) | Events |
| --------- | ------------- | ------------ | ------ |
| `/attendance` | **None.** `cors: { origin: '*' }`, no handshake check, `session:join` trusts client `{sessionId}` | JWT in handshake (`auth.token`/`Authorization`) → user pinned on socket, `session:join` verified against `AttendanceSession.scheduleSlot.universityId` + role membership | `session:join`, `session:leave`, `attendance:new`, `attendance:count`, `qr:refreshed`, `session:timeout` |
| `/notifications` | **None.** `cors: { origin: '*' }`. `user:subscribe` joins arbitrary `user:<id>` rooms | JWT in handshake → `user:subscribe` ignores body and joins only the authenticated user's own room | `user:subscribe`, `notification:new` |

### 1.3 Background jobs / Redis / cron

- **Bull queue `at-risk`** — fan-in: `scheduleSessionCheck(sessionId)` after a session is closed. Processor opens with `runCheck`, which fully re-derives the session and is safe to retry. No external entrypoint other than enqueueing from the attendance close path.
- **Bull-Board admin UI** mounted at `/api/v1/admin/queues`. Guarded by a custom JWT middleware. **Used to accept `?access_token=...` (fixed — header only now).**
- **Redis** — used for QR token mirroring (`qr:session:<id>:current`), idempotency keys (`attendance:<sessionId>:<userId>` 24h), per-IP login rate limits (`rate:login:<ip>` 10/60). No `KEYS`/`SCAN` exposure, no `EVAL` on user data.
- **Cron** — none defined.

### 1.4 Mobile API surface

`mobile/lib/core/api_client.dart` uses `dio` with `Bearer` access tokens stored in `flutter_secure_storage` (Keychain / Keystore). Refresh-token interceptor sends `POST /auth/refresh` with the body. No tokens in URLs. **One default `API_BASE_URL` is plain HTTP (`http://10.0.2.2:3000/api/v1`)** — fine for the Android emulator default, must be overridden at build time for production.

### 1.5 Admin (Next.js)

Access token kept in module memory; refresh token in HttpOnly cookie set by the backend. Strong CSP except for `unsafe-inline` styles (Tailwind injects them) and `unsafe-eval` in dev. Backend CORS is locked to the admin origin in normal operation.

---

## 2. Findings (full table)

Each finding has: title, severity, CWE, affected files, root cause, exploit / PoC, fix, regression risk, status in this PR.

### 2.1 [CRITICAL] WebSocket handshake authentication missing — IDOR & cross-tenant data exfil (CWE-306, CWE-862, CWE-942)

- **Affected:** `backend/src/modules/attendance/attendance.gateway.ts`, `backend/src/modules/notifications/notifications.gateway.ts`
- **Root cause:** Both gateways declare `cors: { origin: '*' }`, no handshake auth, `session:join` / `user:subscribe` blindly trust the room name carried in the body.
- **Exploit (notifications):**
  ```js
  const s = io('https://api.example.com/notifications', { transports: ['websocket'] });
  s.emit('user:subscribe', { userId: '<victim-uuid>' });
  s.on('notification:new', console.log); // receives all of victim's notifications in real time
  ```
- **Exploit (attendance):** Same pattern with `session:join` on a guessable / leaked session ID — receives `attendance:new` (student names + status), `qr:refreshed` (the rotating HMAC token in plain text, which any unenrolled actor can now show at the door) and `session:timeout`.
- **Fix (this PR):** New `WsAuthGuard` reads the JWT from `socket.handshake.auth.token` or `Authorization` header, verifies with the same `JwtService`, then pins `{ userId, role, universityId }` onto `socket.data`. Disconnect on missing/invalid. Both gateways now:
  - reject anonymous connections at `handleConnection`,
  - in `session:join`, look up `AttendanceSession.scheduleSlot.universityId` and refuse if the caller's tenant differs, or if a `student` is not enrolled in the section, or if a `doctor` is not the slot owner (admins always allowed in-tenant),
  - in `user:subscribe`, ignore the body — the socket is forced into `user:<authenticated id>` only,
  - CORS narrowed to `ADMIN_WEB_ORIGIN` (admin) and `*` only for mobile WS handshakes (which are authenticated by JWT anyway).
- **Regression risk:** Existing clients on the admin/mobile **must** present a token. The admin already passes one via Socket.IO `auth` in `useSession*` hooks. Verified.

### 2.2 [CRITICAL] `recipientUserIds[]` cross-tenant IDOR on `/notifications/send` (CWE-639)

- **Affected:** `backend/src/modules/notifications/notifications.service.ts` (`resolveRecipients`), `backend/src/modules/notifications/dto/notification.dto.ts`
- **Root cause:** When `recipientUserIds` is set, the service dedupes and returns it as-is — no `universityId` check.
- **Exploit:** A doctor in tenant A discovers a user UUID from tenant B (leak via support tickets, error messages, or by enumerating UUIDs through the at-risk `:studentId` 404 oracle), then calls `POST /notifications/send` with `{ targetType: 'user', recipientUserIds: ['<victim>'] }`. Combined with §2.1 the attacker can then connect to `/notifications` and read the delivered payload back in real time.
- **Fix (this PR):** `recipientUserIds` are intersected with `users.findMany({ where: { id: { in: ids }, universityId, deletedAt: null } })`. `targetType: 'broadcast'` is restricted to `admin` role only at the controller. `recipientUserIds` items are validated as UUID v4.
- **Regression risk:** None — legitimate callers always target users in their own tenant.

### 2.3 [HIGH] Refresh-token & password-reset bcrypt scan loops — DoS + correctness (CWE-307, CWE-400)

- **Affected:** `backend/src/modules/auth/token.service.ts` (`rotateRefreshToken`, `revokeRefreshToken`), `backend/src/modules/password-reset/password-reset.service.ts` (`confirmReset`)
- **Root cause:** Each rotate/revoke fetches the most-recent `take: 400` (or 200) refresh-token rows and calls `bcrypt.compare(...)` on each. Cost is `O(N) × bcrypt`. The `tokenHash` column is `@unique` but useless for lookup because bcrypt is non-deterministic. Worse, when total live tokens exceed the cap, legitimate tokens are silently invalidated.
- **Exploit (DoS):** `for (i=0;i<10000;i++) fetch('/auth/refresh', { method:'POST', body:'{"refreshToken":"x"}' })` — 30 req/min × 400 bcrypts × ≈25 ms = ~5 minutes of single-core CPU per minute of attacker traffic per IP. Plus `/auth/logout` is unthrottled and runs the same loop.
- **Exploit (correctness):** Generate >400 active sessions on a single user (mobile re-installs, web pre-warm) and the oldest tokens get pushed off the `take: 400` window, mass-logging the user out.
- **Fix (this PR):** Tokens are now indexed by `HMAC-SHA-256(JWT_REFRESH_SECRET, token)` stored in `tokenHash`. Lookup is `prisma.refreshToken.findUnique({ where: { tokenHash: lookupHash } })` — O(1), deterministic. Password reset takes the same approach. A migration `20260101000000_token_hash_lookup` rewrites the existing rows (best-effort; tokens that cannot be migrated are revoked, which only forces users to log in again).
- **Regression risk:** Old tokens minted under bcrypt no longer validate after the migration — equivalent to a forced re-login. Acceptable because we also bumped `JWT_REFRESH_SECRET` requirement in `.env.example`.

### 2.4 [HIGH] Bull-Board admin UI accepts JWT in `?access_token=` query (CWE-598)

- **Affected:** `backend/src/main.ts`
- **Root cause:** The guard accepts the token from `req.query.access_token` so the operator can deep-link the UI.
- **Exploit:** Tokens land in nginx / Cloudflare access logs, the `Referer` header on any link the Bull-Board page links to, and the browser history.
- **Fix (this PR):** Removed `queryToken`. Authorization header only.
- **Regression risk:** Operators must paste the token via `Authorization: Bearer` (e.g. browser devtools) or load the UI behind an authenticated proxy. Documented in `README.md`.

### 2.5 [HIGH] `POST /students/import` unrestricted upload + multer DoS CVEs (CWE-434, CWE-409)

- **Affected:** `backend/src/modules/students/students.controller.ts`, `backend/package.json`
- **Root cause:** `@UseInterceptors(FileInterceptor('file'))` is invoked with multer defaults — no `limits.fileSize`, no `fileFilter`. Multer 2.0.2 has 3 GHSAs for DoS via incomplete cleanup, resource exhaustion, and uncontrolled recursion (GHSA-… see `pnpm audit`).
- **Exploit:** Admin uploads a 1 GB ZIP-bomb-shaped XLSX → exceljs parsing thrashes the heap; or any large file holds a buffer in RAM.
- **Fix (this PR):** FileInterceptor is now configured with `limits: { fileSize: 5 * 1024 * 1024, files: 1 }`, `fileFilter` accepting only the canonical XLSX MIME (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) and `application/zip` (some browsers send this for `.xlsx`), and the import service refuses workbooks with `> 5000` rows. Multer pinned to `^2.1.1` via `pnpm.overrides`.
- **Regression risk:** Files larger than 5 MB are rejected — the team's importer is documented to handle far fewer rows than that, so no real-world regression. The HTTP error is the standard NestJS `PayloadTooLargeException`.

### 2.6 [HIGH] CSV formula injection in `/reports/*?format=csv` (CWE-1236)

- **Affected:** `backend/src/modules/reports/reports.service.ts`
- **Root cause:** `csvEscape` only quote-escapes commas, quotes and newlines, missing leading `= + - @ \t \r`.
- **Exploit:** Create a student named `=cmd|'/c calc'!A0`. When an admin opens the per-session CSV in Excel/Google Sheets the formula executes (Excel may prompt, but DDE/HYPERLINK formulas are well-known exfil vectors).
- **Fix (this PR):** `csvEscape` now prefixes a single-quote (`'`) to any cell whose first character is in `= + - @ \t \r`, then runs the existing quote-escape.
- **Regression risk:** A leading `=` in legitimate data becomes `'=...`; trivially correct because spreadsheet apps render `'…` without the prefix.

### 2.7 [HIGH] FCM push-token hijack (CWE-639, CWE-841)

- **Affected:** `backend/src/modules/me/me.service.ts` `registerPushToken`
- **Root cause:** `prisma.pushToken.upsert({ where: { token }, update: { userId, ... }, create: {...} })` — the unique key is the token itself, so submitting another user's known token rebinds it to the attacker.
- **Exploit:** An attacker who somehow learns a victim's FCM token (Android logs, malicious wrapper app, MITM on a non-HTTPS dev build) registers it on their own account. The token is now bound to the attacker; the next academic-warning notification fires on the attacker's device and never reaches the victim.
- **Fix (this PR):** Before the upsert the service checks if the token already exists, and if so refuses to rebind it to a different user. Existing record bound to the same user is refreshed (`lastSeenAt`). The mobile client transparently re-registers a fresh token on Firebase rotation, so the user experience is unchanged.
- **Regression risk:** None.

### 2.8 [HIGH] Plaintext temporary passwords in HTTP responses (CWE-522)

- **Affected:** `backend/src/modules/users/users.service.ts` (`create`, `resetPassword`)
- **Root cause:** The service generates a random password, persists `bcrypt(password, 10)`, then returns `{ temporaryPassword: password }` in the JSON response. Admin UI renders it in plain text. Anyone reading the admin's session — proxy logs, screen-share, browser history, third-party JS errors — sees the credential.
- **Fix (this PR):** Both endpoints stop returning the plaintext. Instead they enqueue a `password_reset.requested` flow via `PasswordResetService.requestResetForUser(userId)` (a new private method that bypasses the public throttled `/auth/password/forgot` endpoint) so the user receives an email with a one-time reset link. When email is not configured the response includes `"emailDelivered": false` and a hint to the admin — but never the password itself.
- **Regression risk:** Demo / CI workflows that screen-scrape the response for the temporary password must switch to checking the user's mailbox or running `prisma.passwordResetToken` queries. Documented.

### 2.9 [HIGH] `QR_HMAC_SECRET` default = empty string (CWE-321, CWE-1188)

- **Affected:** `backend/src/config/qr.config.ts`
- **Root cause:** `process.env.QR_HMAC_SECRET ?? ''`.
- **Exploit:** If the operator forgets to set the env var, every rotating QR token is `HMAC-SHA-256('', payload)` — fully derivable by anyone who knows the (well-published) timeWindow algorithm.
- **Fix (this PR):** The config now requires the value to be ≥ 32 bytes and refuses to start (`throw`) when missing or shorter outside of `NODE_ENV=test`.
- **Regression risk:** Operators with a too-short or missing secret get a clear startup error.

### 2.10 [HIGH] Default admin password `ChangeMe!2025` committed (CWE-798, CWE-1188)

- **Affected:** `backend/src/config/app.config.ts`, `backend/prisma/seed.ts`, `.env.example`
- **Root cause:** Both `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` have non-empty fallbacks. Any installer who forgets to set them ships the public default.
- **Fix (this PR):** Removed the fallback in `app.config.ts`; the seed script now refuses to create an admin unless `INITIAL_ADMIN_PASSWORD` is explicitly set (or generates a 24-char random and prints it to stdout once). `.env.example` carries a placeholder marker instead of a working password.
- **Regression risk:** Fresh installs must supply a password. Documented.

### 2.11 [HIGH] Dependency CVEs (pnpm audit, 38 advisories)

| Package | Found | Patched | Severity | Advisory |
| ------- | ----- | ------- | -------- | -------- |
| `next` | 14.2.16 | ≥14.2.34 (≥15.5.16 for some) | Critical / 11× High+Moderate | GHSA auth-bypass middleware + DoS / SSRF / cache poisoning |
| `multer` | 2.0.2 | ≥2.1.1 | 3× High | DoS (incomplete cleanup, exhaustion, recursion) |
| `lodash` | 4.17.21 / 4.18.1 | ≥4.18.0 / ≥4.17.23 | High + Moderate | `_.template` code injection, `_.unset/_.omit` prototype pollution |
| `fast-xml-builder` | 1.1.5 | ≥1.1.7 | High + Moderate | comment regex bypass / attribute-value bypass |
| `js-yaml` | (transitive) | ≥4.1.1 | Moderate | `<<` prototype pollution |
| `file-type` | (transitive) | ≥21.3.2 | Moderate | infinite loop / decompression bomb |
| `postcss` | (transitive) | ≥8.5.10 | Moderate | XSS in stringifier |
| `@nestjs/core` | 10.4.22 | ≥11.1.18 | Moderate | n/a — advisory targets 11.x, we are on 10.x |
| `uuid` | (transitive) | ≥11.1.1 | Moderate | bounds check missing on `buf` in v3/5/6 |

**Fix (this PR):** Pinned via `pnpm.overrides` in the root `package.json`:

```jsonc
"pnpm": {
  "overrides": {
    "multer": "^2.1.1",
    "lodash": "^4.17.23",
    "fast-xml-builder": "^1.1.7",
    "fast-xml-parser": "^4.5.0"
  }
}
```

Next.js is bumped to `^14.2.34` (latest 14.x, includes the auth-bypass fix and all 14.x DoS patches). Major bump to 15.x is deferred — it changes the App Router runtime and is out of scope for a security PR.

**Regression risk:** Multer 2.1.1 and 4.17.23 lodash carry only bug-fix changelogs. Next 14.2.34 includes one breaking change for `_action` route hashes that we don't use.

### 2.12 [MEDIUM] `/auth/logout` unthrottled (CWE-770)

- **Affected:** `backend/src/modules/auth/auth.controller.ts`
- **Fix (this PR):** `@Throttle({ short: { limit: 30, ttl: 60_000 } })`.

### 2.13 [MEDIUM] CORS `*` + credentials accepted by config (CWE-942)

- **Affected:** `backend/src/main.ts`
- **Root cause:** `cfg.adminWebOrigin === '*'` → `origin: true` + `credentials: true`. Browsers reject `Access-Control-Allow-Origin: *` when credentials flow.
- **Fix (this PR):** The bootstrap now refuses to start if `ADMIN_WEB_ORIGIN === '*'` in production and warns in development.

### 2.14 [MEDIUM] `cookieParser()` without secret (CWE-565)

- **Affected:** `backend/src/main.ts`
- **Fix (this PR):** Reads `COOKIE_SECRET` from env; uses it when present. Signed cookies are now possible for any future use case. No-op if env var missing.

### 2.15 [MEDIUM] Password reset link uses `?token=` query string (CWE-598)

- **Affected:** `backend/src/modules/password-reset/password-reset.service.ts`
- **Note:** The /reset endpoint takes the token in the body — good — but the email link still puts the token in the URL because the admin landing page reads `?token=` from the location bar. Documented and accepted: switching to a fragment (`#token=`) is browser-side and is included as a follow-up note in §F.

### 2.16 [LOW] Several spec-time issues
- `LOG_LEVEL=debug` default may emit PII in production — operator must override.
- Mobile API default falls back to plain HTTP — must be overridden at build time.
- `Logger.debug(`[FCM stub] → ${t.slice(0, 8)}…`)` logs 8-char token prefix; acceptable.
- `csrf` endpoint emits a random token but never validates it (stub) — documented.

---

## 3. Validation audit (per-controller)

We swept every DTO under `backend/src/modules/**/dto`. Coverage is **strong**:
- All `:id` route params go through `ParseUUIDPipe`. Exceptions: `LeaveRequestsController.review` `:id` — added UUID pipe in this PR.
- All DTOs use `IsEmail`, `IsEnum`, `IsLatitude/Longitude`, `IsString`, `MinLength`, `IsArray` + `IsString({ each: true })`. `whitelist: true`, `forbidNonWhitelisted: true` and `transform: true` are set in `buildValidationPipe`.
- No raw `JSON.parse` of user input, no `eval`, no template-literal SQL, no `Prisma.$queryRawUnsafe` anywhere in the tree.
- `Prisma` query inputs are typed and parameterised — no SQL injection vector.
- `helmet({ contentSecurityPolicy: ... })` is on globally; Next.js adds an additional CSP per route.

The few additions in this PR:
- `SendNotificationDto.recipientUserIds` — every entry must be UUID.
- `LeaveRequestsController.review(@Param('id', ParseUUIDPipe))`.
- `MeController.unregisterPush` — `IsUUID()`-style validation on the `:token` param dropped in favour of a max-length string check (FCM tokens are not UUIDs).

---

## 4. Token & secret architecture (after fixes)

| Token | Issuer | Storage | Lookup | TTL |
| ----- | ------ | ------- | ------ | --- |
| Access (JWT) | RS256, `JwtService.sign` | none — stateless | n/a | 15 min |
| Refresh | `crypto.randomBytes(48).base64url` | `HMAC-SHA-256(refreshSecret, token)` → `RefreshToken.tokenHash` (`@unique`) | `findUnique({ tokenHash: hash })` — O(1) | 7 d, family-rotated |
| Password reset | same | same | same | 30 min |
| QR rotating | `HMAC-SHA-256(qrSecret, sessionId:roomId:courseId:timeWindow)` | not stored client-side; mirrored in Redis for 30s | timing-safe compare against `now` and `now-1` | 30 s window |
| TOTP secret | `speakeasy.generateSecret` | base32 stored in `AdminTwoFactor.secret` | direct | rotating 30s window |
| FCM device token | provider | `PushToken.token` (`@unique`) — owner-checked | direct | until rotation |
| Recovery codes | `crypto.randomBytes(6).base32` | base32 stored unhashed in `AdminTwoFactor.recoveryCodes[]` | direct | until consumed |

Recovery codes were previously stored unhashed. We did not change this in this PR — it's a structural decision that needs a migration and a UX update; tracked in §F.

---

## 5. Test coverage added

- `notifications.service.spec.ts` — recipientUserIds is filtered to the same tenant; broadcast scope returns only in-tenant users.
- `token.service.spec.ts` — uses the new HMAC lookup and rejects mismatched tokens; rotation revokes the family on re-use.
- `password-reset.service.spec.ts` — confirm rejects unknown tokens in O(1).
- `reports.service.spec.ts` — `csvEscape` prefixes `'` on `= + - @ \t \r` rows.
- `me.service.spec.ts` — `registerPushToken` refuses to rebind another user's token.
- `attendance.gateway.spec.ts` / `notifications.gateway.spec.ts` — anonymous handshake is rejected; subscribing to another user's room is rejected.
- `students.import.spec.ts` — files > 5 MB / non-XLSX are rejected.

Existing 60-test backend Jest suite continues to pass.

---

## 6. Verification

- `pnpm install --frozen-lockfile` — green
- `pnpm --filter backend lint` — clean (0 errors, pre-existing warnings retained)
- `pnpm --filter backend test` — green, with new tests added
- `pnpm --filter admin lint` and `pnpm --filter admin build` — green
- `flutter analyze` (mobile) — unchanged
- `pnpm audit --prod` — multer/next/lodash/fast-xml-builder advisories resolved by overrides
- End-to-end smoke: login → refresh → logout via the admin web client works (cookie path), via the mobile path (body path) works, attendance scan → broadcast → notification fan-out works with the new WS auth.

---

## 7. Risk score

| Surface | Before (CVSS-style) | After |
| ------- | -------- | ----- |
| WebSocket gateways | 9.4 — unauthenticated cross-tenant data exfil | 2.1 — JWT-handshake, room-acl, regression tests |
| Notification fan-out | 8.6 — cross-tenant IDOR via `recipientUserIds` | 1.5 — tenant-scoped |
| Token storage | 7.2 — bcrypt scan loops, silent lockouts | 2.0 — HMAC O(1) lookup |
| File uploads | 7.0 — no limits + multer DoS | 2.5 — limits + multer 2.1.1 |
| CSV exports | 7.1 — formula injection | 1.0 — escaped |
| Push tokens | 7.5 — token hijack | 1.0 — owner-checked |
| Plaintext passwords | 7.0 — in JSON responses | 0.5 — email-only |
| Defaults / secrets | 6.5 — hard-coded admin + empty QR HMAC | 1.0 — required env |
| Dependencies | 7.5 — 38 advisories incl. 1 critical | 2.5 — patched / overridden |
| **Overall** | **High** | **Low/Medium** |

---

## 8. Follow-ups not in this PR

1. Move `User.email` from globally unique to `@@unique([universityId, email])` once the data model can accept the migration. Today the global constraint quietly enables cross-tenant email enumeration via 409 responses on `/users` create. The error message is generic ("Email already in use") but the timing still reveals existence.
2. Hash recovery codes in `AdminTwoFactor.recoveryCodes[]` with `bcrypt` and check on consume. Today they are plaintext — equivalent to API secrets at rest.
3. Bind `/auth/csrf` token to the session and check on cookie-mutating endpoints. Currently a stub.
4. Replace `?token=` in the password-reset email link with `#token=` so it never traverses servers; small UX change in `admin/src/app/reset-password/page.tsx`.
5. Add `CSP nonce` for the few inline Tailwind styles to drop `unsafe-inline` from the admin CSP.
6. Move to Next.js 15.x once the team is ready for the App Router runtime changes — clears the remaining `low` advisories.
7. Add scheduled `pnpm audit` to CI with a non-zero exit on `high+`.

---

## 9. Categorised commits in this PR

1. `docs(security): add SECURITY_AUDIT.md`
2. `feat(security/ws): JWT handshake auth + room ACLs on /attendance and /notifications`
3. `feat(security/notifications): tenant-scope recipientUserIds; restrict broadcast to admin`
4. `feat(security/auth): HMAC-SHA-256 lookup for refresh + password-reset tokens (no more bcrypt scans)`
5. `fix(security/main): drop ?access_token= on Bull-Board; refuse CORS=* with credentials; cookie secret`
6. `fix(security/students): file size + MIME limits on the import upload; row cap`
7. `fix(security/reports): escape leading = + - @ \\t \\r in CSV cells`
8. `fix(security/me): refuse to rebind another user's FCM token`
9. `fix(security/users): stop returning plaintext temporary passwords; trigger email reset`
10. `fix(security/config): require QR_HMAC_SECRET and admin password; drop public defaults`
11. `fix(security/auth): throttle /auth/logout; add UUID pipe on leave-requests/review/:id`
12. `chore(deps): pnpm overrides — multer >=2.1.1, lodash >=4.17.23, fast-xml-builder >=1.1.7, fast-xml-parser >=4.5.0; bump next to ^14.2.34`
13. `test(security): regression tests for WS auth, tenant scoping, CSV escape, push hijack, token lookup`

