# Security Audit — May 2026

Audited surface: backend (NestJS), admin (Next.js 14), mobile (Flutter), CI, deps.
Audit follows the OWASP Top 10 (2021) + ASVS L1 checklist plus a project-specific
focus on the rotating-QR / WebSocket attendance flow.

This document accompanies the security-audit pull request and tracks every
finding plus its remediation. Findings are listed in descending severity.

---

## 1. Scope and methodology

| Surface | Files reviewed | Tooling |
|---|---|---|
| Backend API (`backend/src/**`) | 100% of controllers, services, gateways, guards, middleware | `tsc --noEmit`, `eslint`, `jest`, manual API trace |
| Admin web (`admin/src/**`) | auth-store, fetch wrapper, middleware, security headers | `next lint`, `tsc`, `pnpm audit` |
| Mobile (`mobile/lib/**`) | auth interceptors, token storage, deeplinks | manual review |
| Dependencies | `pnpm audit --prod` (admin + backend) | pnpm overrides where possible |
| Runtime config | `main.ts`, `next.config.js`, CI workflow | manual review |

API flow was traced exhaustively end-to-end for the four highest-risk paths:
**login → 2FA → refresh**, **rotating QR generation → scan**, **password reset
request → confirm**, and **WebSocket session join → live event broadcast**.

---

## 2. Findings and remediation

Legend — Sev: **C**ritical / **H**igh / **M**edium / **L**ow.
Status — ✅ Fixed in this PR / 📝 Documented future work.

### CRITICAL

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | C | **WebSocket `/attendance` namespace had no authentication.** Anyone could open a socket and join `session:<id>` to receive the live event stream — including the broadcast `qr:refreshed` event, which **leaked the rotating HMAC-SHA256 QR token to passive listeners**. This single defect undermined the whole attendance system. | ✅ Fixed |
| 2 | C | **WebSocket `/notifications` namespace allowed an IDOR.** A client could connect (unauthenticated) and emit `user:subscribe { userId: "any-target" }` to subscribe to another user's notification stream. | ✅ Fixed |
| 3 | C | **WebSocket CORS was `*` on both gateways.** Combined with cookie-based session auth on the admin web, this opened a cross-origin socket vector. | ✅ Fixed |
| 4 | C | **QR token rebroadcast on every rotation.** Even with sockets authenticated, the rotating token (TOTP-style HMAC) was being emitted on `qr:refreshed` to every joined client. A compromised student device could silently relay it to other devices to fake "presence" elsewhere. | ✅ Fixed — token no longer travels over WS; doctor clients re-fetch via authenticated REST `GET /attendance/session/:id/qr`. |
| 5 | C | **Next.js 14.2.16 — Authorization Bypass in middleware** ([GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw)). Allows bypassing checks in `middleware.ts` via crafted `x-middleware-subrequest`. | ✅ Fixed — bumped admin to **14.2.35**. |

**Remediation details for #1–#4:**
- Added `src/common/websocket/ws-auth.helper.ts`: pure-function JWT verification
  that accepts a token from either `auth.token` (socket.io-client) or the
  `Authorization: Bearer` header (mobile WS clients).
- Rewrote both gateways: `handleConnection` verifies the handshake and
  disconnects with an `auth:error` event if invalid.
- For `/attendance`: introduced an explicit `canJoinSession()` ACL — students
  may only join active sessions for **their own section in their own tenant**;
  doctors and admins are scoped to their tenant.
- For `/notifications`: the gateway auto-joins `user:<authenticatedUserId>` on
  connection and the legacy `user:subscribe` message now ignores the
  client-supplied ID entirely.
- For `emitQrRefresh`: the token argument is now `_unused`; the payload is
  reduced to `{ expiresAt }`. The QR fetch lives at the existing authenticated
  REST endpoint and is the only path that returns the secret.

### HIGH

| # | Sev | Finding | Status |
|---|---|---|---|
| 6 | H | **Bull-Board accepted `?access_token=` query parameter.** Bearer tokens in query strings leak into nginx / CDN / browser-history access logs (CWE-598). | ✅ Fixed — only `Authorization` header is now accepted; `WWW-Authenticate` challenge sent on 401. |
| 7 | H | **Refresh-token rotation did `bcrypt.compare` against 400 rows** in a tight loop. (a) DoS surface — a single rotate-refresh request consumed up to ~40 s of CPU and could be repeated; (b) **silent failure**: if a user had ≥401 historical tokens, their legitimate refresh was rejected as "TOKEN_INVALID" because it was never tested. | ✅ Fixed — schema column `tokenHash` now stores `sha256(token)`; lookup is a single `findUnique` on the existing unique index. SHA-256 alone is safe here because refresh tokens carry 384 bits of entropy (`crypto.randomBytes(48)`). |
| 8 | H | **Password-reset confirmation had the same bcrypt-scan-all pattern.** Same DoS and silent-failure modes; reset tokens carry 256 bits of entropy. | ✅ Fixed — same SHA-256-fingerprint pattern. |
| 9 | H | **Student-bulk-import upload accepted unbounded size and any MIME type.** A malicious admin could OOM the server with a multi-GB upload, or attempt zip-bomb / parser-confusion attacks via xlsm/macros. | ✅ Fixed — Multer `limits: { fileSize: 5 MB, files: 1 }`; `fileFilter` rejects non-xlsx extensions and non-spreadsheet MIME types. |
| 10 | H | **Multer 2.0.2 — DoS via incomplete cleanup** ([advisory](https://github.com/advisories/GHSA-fjgf-rc76-4x9p)). Transitive via `@nestjs/platform-express`. | ✅ Fixed — pnpm override `"multer@<2.1.1": ">=2.1.1"`. |
| 11 | H | **Next.js 14.2.16 — DoS via Server Components** (GHSA-mwv6-3258-q52c, GHSA-5j59-xgg2-r9c4). | ✅ Fixed — same Next.js bump. |

### MEDIUM

| # | Sev | Finding | Status |
|---|---|---|---|
| 12 | M | **Swagger UI exposed in production** at `/api/v1/docs`. Full schema, route inventory, and error-code matrix were public. Reconnaissance gold for an attacker. | ✅ Fixed — disabled unless `NODE_ENV != production` OR `ENABLE_SWAGGER_UI=true`. |
| 13 | M | **JWT strategy did not re-check `user.isActive` / `deletedAt`.** A deactivated user kept full access for the full access-token expiry (up to 15 min). Role/tenant changes also didn't take effect until next login. | ✅ Fixed — strategy now reads the user row through a 30-second Redis cache (so most requests stay sub-ms) and rejects tokens whose claims drift from the DB or whose user has been deactivated/deleted. |
| 14 | M | **`scheduleSlotId` and other IDs typed as `@IsString` instead of `@IsUUID`.** Mass-assignment hardening missing; ranges (`intervalSeconds`, `lateAfterMinutes`) had no bounds. | ✅ Fixed — `StartSessionDto`, `ScanQrDto`, `ManualOverrideDto`, password-reset DTOs, me-controller DTOs all tightened: `@IsUUID()`, `@MaxLength`, `@Min/@Max`, `@IsLatitude/@IsLongitude`, `@Matches` for phone & TOTP code. |
| 15 | M | **Password complexity ≥ 8 chars only.** No upper/lower/digit/symbol requirement; common dictionary words accepted. | ✅ Fixed — new `IsStrongPassword` validator: 12 chars + mixed case + digit + symbol; bans the top ~50 throwaway passwords. Used by reset, change-password, and (length-only) login. |
| 16 | M | **Per-device scan rate-limit was bypassable.** If `deviceFingerprint` was omitted from the body, the per-device key was never set — students could scan unrestricted by simply not sending the field. | ✅ Fixed — now also rate-limited per **authenticated user** (10 scans / 30 s) on top of the optional per-device cap (5 / 30 s). |
| 17 | M | **Lodash transitive < 4.17.21 — prototype pollution** (multiple CVEs). | ✅ Fixed — pnpm override `"lodash@<4.17.21": ">=4.17.21"`. |

### LOW

| # | Sev | Finding | Status |
|---|---|---|---|
| 18 | L | **Client-supplied `X-Request-Id` was echoed verbatim** into responses and pino log lines. A crafted value containing CR/LF could split log lines or, in some downstream sinks, smuggle headers (CWE-93 / log-injection). | ✅ Fixed — accepted values must match `^[A-Za-z0-9._-]{1,128}$`, otherwise we generate a fresh UUID. |
| 19 | L | **`replacedBy` column stored the first 12 chars of the new raw refresh token.** A leak of this column (e.g. via a verbose error / backup) would expose prefix material that could potentially correlate sessions. | ✅ Fixed — now stores the first 12 chars of the SHA-256 fingerprint, which is a one-way digest. |
| 20 | L | **`bcryptjs` still imported in `token.service.ts`** after the rewrite. Dead import / supply-chain noise. | ✅ Fixed — removed. |

---

## 3. Files changed

```
backend/src/common/websocket/ws-auth.helper.ts         (new — central WS JWT verify)
backend/src/common/websocket/ws-auth.helper.spec.ts    (new — 5 tests)
backend/src/common/validators/strong-password.ts       (new — NIST-aligned validator)
backend/src/common/validators/strong-password.spec.ts  (new — 8 tests)
backend/src/main.ts                                    (Bull-Board, swagger gate, req-id regex)
backend/src/modules/attendance/attendance.gateway.ts   (full rewrite: auth + ACL + no-token-on-wire)
backend/src/modules/attendance/attendance.module.ts    (imports AuthModule for JwtService)
backend/src/modules/attendance/attendance.service.ts   (per-user scan rate limit)
backend/src/modules/attendance/dto/attendance.dto.ts   (UUID/length/range validation)
backend/src/modules/auth/dto/login.dto.ts              (length/regex hardening)
backend/src/modules/auth/jwt.strategy.ts               (isActive / claims-drift re-check)
backend/src/modules/auth/token.service.ts              (SHA-256 fingerprint lookup)
backend/src/modules/auth/token.service.spec.ts         (rewritten for new flow)
backend/src/modules/me/me.controller.ts                (DTO hardening)
backend/src/modules/me/me.service.ts                   (IsStrongPassword + no-reuse)
backend/src/modules/notifications/notifications.gateway.ts (auth + IDOR fix)
backend/src/modules/notifications/notifications.module.ts  (imports AuthModule)
backend/src/modules/password-reset/password-reset.controller.ts (DTO hardening)
backend/src/modules/password-reset/password-reset.service.ts    (SHA-256 + IsStrongPassword)
backend/src/modules/students/students.controller.ts    (Multer size/MIME limits)
admin/package.json                                     (next 14.2.16 → 14.2.35)
package.json                                           (pnpm overrides for multer + lodash)
```

## 4. Verification

| Check | Result |
|---|---|
| Backend `tsc --noEmit` | ✅ 0 errors |
| Backend `pnpm lint` | ✅ 0 errors (10 pre-existing warnings) |
| Backend `pnpm test` | ✅ 74 / 74 tests passing (61 before, +13 new) |
| Admin `next lint` | ✅ no errors |
| Admin `next build` | ✅ success on Next.js 14.2.35 |
| Admin `pnpm audit --prod` | The remaining advisories require a Next.js 15 major upgrade and are filed as 📝 follow-up. |

## 5. Recommended follow-up (out of scope for this PR)

- 📝 Bump admin to **Next.js 15.x** to close the remaining moderate-severity
  CVEs (`>=13.0.0 <15.0.8`). Major version bump — requires a separate PR for
  the App Router / Server Components migration tests.
- 📝 Add an **integration test** that opens a raw socket to `/attendance` with
  a forged token and asserts the connection is dropped — the unit tests cover
  the helper but not the live wiring.
- 📝 Introduce **CSRF tokens on cookie-authenticated POSTs** (currently
  mitigated by `SameSite=Strict`; defense-in-depth would be ideal).
- 📝 Add **outbound-response redaction** for pino logs (`Set-Cookie`, full
  JWTs in 401 bodies). Currently we don't log response bodies, so this is
  preventive.
- 📝 Track **`replacedBy` lineage** end-to-end in audit so a token-theft
  detection event triggers a tenant-admin notification.
