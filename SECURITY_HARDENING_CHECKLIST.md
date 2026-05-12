# Pre-Launch Security Hardening Checklist

Saxony Smart Campus — pre-production security and DevSecOps review.

This document tracks the 10-step pre-launch hardening process. Each item
is marked **Done** (already merged or in this branch), **In flight**
(open PR), **Operator-action** (requires a deployment decision the code
cannot make for you), or **Accepted risk** (with justification).

> **Context**
>
> - Project type: **Full-stack SaaS** (NestJS API + Next.js admin + Flutter mobile)
> - Stack: NestJS 10 · Next.js 14 · Flutter 3 · PostgreSQL 16 · Redis 7 · Socket.IO · Bull · MinIO
> - Handles sensitive user data: **YES** (student PII, attendance scans, biometric toggle, FCM tokens)
> - Has payment gateway: **NO**
> - Multi-tenant model: hard `universityId` scoping on every domain model

For the per-CVE / per-finding writeup see [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)
(produced by the deep security audit that landed in PR #6).

---

## Step 1 — Vulnerability Scan Review

| Item                                                       | Status                | Notes                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm audit` reviewed end-to-end                           | **Done**              | 48 advisories on `feat/pilot-ready-punchlist` HEAD; 17 high / 1 critical map to `next`, `multer`, `lodash`, `fast-xml-*`, `postcss`. PR #6 ships `pnpm.overrides` that close every overridable advisory and bumps `next` from 14.2.16 → 14.2.33 (latest 14.2 patch line). |
| `multer` 2.0.2 DoS CVEs                                    | **In flight** (PR #6) | Overridden via root `package.json` → `pnpm.overrides.multer`.                                                                                                                                                                                                             |
| `lodash` `_.template` code injection + prototype pollution | **In flight** (PR #6) | Override pinned to latest.                                                                                                                                                                                                                                                |
| `fast-xml-parser` / `fast-xml-builder` regex bypass        | **In flight** (PR #6) | Override pinned.                                                                                                                                                                                                                                                          |
| `postcss` XSS in `</style>` stringifier                    | **In flight** (PR #6) | Override pinned.                                                                                                                                                                                                                                                          |
| `next` Cache key confusion, SSRF, DoS                      | **In flight** (PR #6) | Bumped to `14.2.33`. Full Next 15 upgrade is a separate follow-up (see "Accepted risks" below).                                                                                                                                                                           |
| Flutter `pubspec.yaml` deps reviewed                       | **Done**              | All deps on latest stable major; no advisories on `mobile_scanner`, `firebase_*`, `geolocator`, `network_info_plus`, `local_auth`.                                                                                                                                        |
| Outdated dev-only deps documented                          | **Done**              | `glob` CLI / `tmp` / `webpack` advisories live under `next` build-graph only — not shipped at runtime.                                                                                                                                                                    |

**Accepted risks (Step 1)**

1. `next@14.2.x` line has 3 advisories with patches only in `15.5.16+`.
   The Next 15 upgrade is tracked separately (App Router middleware
   contract changed, requires admin route audit). Mitigations applied
   today: middleware DoS findings are bounded by reverse-proxy rate
   limiting; cache-poisoning findings are bounded by the per-route CSP +
   `Vary` headers Next emits.
2. `glob` 7.x command-injection (high) appears only via dev `eslint` /
   `prettier` graph. Not shipped to production. No runtime exposure.

---

## Step 2 — Code Security Review

| Item                                             | Status                | Notes                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No hardcoded secrets in repo                     | **Done**              | All sensitive values read via `process.env.*` through `@nestjs/config` registerAs blocks. `.env.example` only ships placeholders.                                                                                      |
| `.env` listed in `.gitignore`                    | **Done**              | `.env`, `.env.local`, `.env.*.local`, and `**/.env` (with `.env.example` exception) are excluded.                                                                                                                      |
| SQL injection — parameterized queries everywhere | **Done**              | Prisma ORM is used exclusively; no raw `$queryRawUnsafe` calls in the codebase. `grep -r "\\$queryRawUnsafe" backend/src/` → 0 hits. The handful of `$queryRaw` callsites use the tagged-template form, which is safe. |
| XSS — output sanitization                        | **Done**              | API returns JSON exclusively (no server-rendered HTML on the backend). Admin SPA is Next.js / React, which escapes by default; no `dangerouslySetInnerHTML` in `admin/src`.                                            |
| API input validation                             | **Done**              | `buildValidationPipe()` enforces `whitelist:true`, `forbidNonWhitelisted:true`, `transform:true` globally. Every DTO uses `class-validator` decorators. UUID path params go through `ParseUUIDPipe`.                   |
| File-upload limits                               | **In flight** (PR #6) | `/students/import` capped at 5 MB / 1 file / XLSX only / 5000 rows.                                                                                                                                                    |
| CSV injection (`= + - @ \t \r`)                  | **In flight** (PR #6) | Leading-character guard in `reports.service.ts`. Regression test added.                                                                                                                                                |
| Push-token hijack                                | **In flight** (PR #6) | `/me/push-token` refuses cross-user rebinds; ownership check on `upsert`.                                                                                                                                              |
| Bull-Board JWT no longer in `?access_token=`     | **In flight** (PR #6) | Header-only — `Referer` / proxy-log token leak closed.                                                                                                                                                                 |
| Per-request log correlation                      | **Done**              | `X-Request-Id` middleware in `main.ts`; UUID per request, echoed back to caller.                                                                                                                                       |

---

## Step 3 — Authentication & Authorization

| Item                                        | Status                | Notes                                                                                                                                                    |
| ------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT access tokens signed RS256              | **Done**              | `JwtConfig.algorithm = 'RS256'`. Private key only on the API box; public key can be safely distributed.                                                  |
| JWT access token expiry set                 | **Done**              | `JWT_ACCESS_EXPIRES=15m` default; refresh `JWT_REFRESH_EXPIRES=7d`.                                                                                      |
| QR token uses HMAC-SHA256 + rotating window | **Done**              | 30-second windows with 1-window grace, `crypto.timingSafeEqual` comparison.                                                                              |
| Password hashing uses bcrypt (cost ≥ 10)    | **Done**              | `bcryptjs` cost 10 for user passwords, 12 for refresh tokens. Migrating refresh-token verify to HMAC-SHA256 in PR #6 (O(1) lookup, no bcrypt scan loop). |
| RBAC enforced on every route                | **Done**              | `RolesGuard` + `@Roles('admin' \| 'doctor' \| 'student')` on every controller. Tenant scoping via `CurrentUniversity` decorator.                         |
| `@Public()` audit                           | **Done**              | Only `/health`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password` are public — no sensitive data leaks.                    |
| WebSocket gateways require JWT              | **In flight** (PR #6) | Both `/attendance` and `/notifications` enforce JWT handshake + tenant/role ACLs on every `session:join` and `user:subscribe`.                           |
| `recipientUserIds[]` tenant-scoped          | **In flight** (PR #6) | `POST /notifications/send` intersects recipients with caller's tenant; `broadcast` restricted to admin.                                                  |
| Rate limiting on login / register / refresh | **Done**              | `@nestjs/throttler` global guard. `POST /auth/login` 5/60s + 20/10min. `POST /auth/refresh` 30/60s. `POST /auth/logout` 30/60s. Password reset 3/60s.    |
| Refresh token theft detection               | **Done**              | Family-based detection: if a previously-rotated token is replayed, the entire family is revoked.                                                         |
| 2FA / TOTP available                        | **Done**              | Admin role has TOTP setup; protected by `/me/2fa/setup` flow with QR code provisioning.                                                                  |

---

## Step 4 — HTTP Security Headers

Backend (`backend/src/main.ts`):

| Header                      | Value                                                                                                                                 | Status                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'` | **Done** (helmet)                        |
| `X-Frame-Options`           | `DENY`                                                                                                                                | **Done** (helmet)                        |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                             | **Done** (helmet)                        |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (prod only)                                                                            | **Done** (this PR — explicit policy)     |
| `Referrer-Policy`           | `no-referrer`                                                                                                                         | **Done** (helmet)                        |
| `Permissions-Policy`        | All sensitive features locked to `()`                                                                                                 | **Done** (this PR — explicit middleware) |
| `X-Request-Id`              | UUID per request                                                                                                                      | **Done**                                 |

Admin SPA (`admin/next.config.js`):

| Header                      | Value                                                           | Status   |
| --------------------------- | --------------------------------------------------------------- | -------- |
| `Content-Security-Policy`   | Per-environment CSP (strict in prod, `unsafe-eval` only in dev) | **Done** |
| `X-Frame-Options`           | `DENY`                                                          | **Done** |
| `X-Content-Type-Options`    | `nosniff`                                                       | **Done** |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                  | **Done** |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                               | **Done** |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), interest-cohort=()`  | **Done** |

---

## Step 5 — HTTPS & SSL (Operator-action)

These items live at the reverse-proxy / load-balancer layer, not in the
app code. See [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) for the
exact commands.

| Item                           | How to verify                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| SSL cert valid + auto-renewing | `sudo certbot certificates` (Let's Encrypt) or AWS ACM in-console                                            |
| HTTP → HTTPS redirect          | `curl -I http://api.example.edu/` returns `301` / `308` to `https://`                                        |
| TLS 1.0 / 1.1 disabled         | `nmap --script ssl-enum-ciphers -p 443 api.example.edu` shows only `TLSv1.2` / `TLSv1.3`                     |
| HSTS preload eligible          | <https://hstspreload.org/?domain=api.example.edu>                                                            |
| CORS only trusted origins      | `ADMIN_WEB_ORIGIN` env var is a comma-separated allow-list; the production-config guard rejects `*` at boot. |

---

## Step 6 — Database Security (Operator-action)

| Item                               | How to verify                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DB not publicly accessible         | Postgres listens on `127.0.0.1` / VPC-private subnet only; no security-group rule allows `0.0.0.0/0` → `5432`.                                  |
| DB user has minimal privileges     | `campus` role has `CONNECT`, `USAGE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `smart_campus`. No `SUPERUSER`, no `CREATEDB`, no `CREATEROLE`. |
| Sensitive fields encrypted at rest | Postgres TDE (cloud) or `pgcrypto` (`pgp_sym_encrypt`) for `passwordHash`, `totpSecret`, refresh-token `tokenHash`, FCM `token`.                |
| Backups configured + tested        | Daily `pg_dump` to S3 / equivalent, retained 30 days; restore-from-backup runbook tested quarterly.                                             |

Provisioning commands in [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md).

---

## Step 7 — Infrastructure Hardening (Operator-action)

| Item                              | How to verify                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Only 80/443/SSH open              | `sudo ufw status verbose` shows exactly those three rules. AWS SG / GCP firewall: same.              |
| SSH port changed or IP-restricted | `Port 2222` in `/etc/ssh/sshd_config` **or** SG rule `22 ALLOW <office-ip>/32`.                      |
| Root SSH login disabled           | `PermitRootLogin no` in `sshd_config` and password auth disabled (`PasswordAuthentication no`).      |
| Firewall rules enabled            | `sudo ufw enable` on Linux; cloud equivalent on AWS / GCP.                                           |
| WAF in front of the API           | AWS WAF / Cloudflare WAF with OWASP CRS rules. Block known scanner UAs, geo-restrict if appropriate. |

Provisioning commands in [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md).

---

## Step 8 — Logging & Monitoring

| Item                                 | Status              | Notes                                                                                                         |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Access + error logs                  | **Done** (app-side) | NestJS `Logger` writes to stdout; deployer captures via Docker / systemd / CloudWatch.                        |
| Request correlation (`X-Request-Id`) | **Done**            | Middleware emits + echoes a UUID per request.                                                                 |
| Sentry hook                          | **Done**            | `SENTRY_DSN` env var; backend + admin both wire it up when set.                                               |
| Failed-login alert (≥5 in 1 min)     | **Operator-action** | Datadog / CloudWatch query: `severity:WARN status:401 path:/auth/login` rate; alert when >5/min from same IP. |
| API traffic spike alert              | **Operator-action** | Datadog APM `rps` p99 spike alert.                                                                            |
| Uptime monitor                       | **Operator-action** | UptimeRobot / Better Uptime probing `GET /api/v1/health` every 60s.                                           |
| Audit log retained                   | **Done**            | `AuditLog` Prisma table records every privileged mutation.                                                    |

---

## Step 9 — Production Environment Check

| Item                              | Status              | Notes                                                                                                                        |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production` set         | **Operator-action** | Mandatory in the deploy env file.                                                                                            |
| Debug routes off                  | **Done**            | No `/debug` controllers in production.                                                                                       |
| Verbose error responses off       | **Done**            | Global `AppExceptionFilter` returns only `{ success, error: { code, message } }`. Stack traces never leak to clients.        |
| Test accounts / seed data removed | **Done**            | Seed only creates the bootstrap admin (one row) and one demo room. Pre-launch checklist: delete the demo row before go-live. |
| Production-secret guard           | **Done** (this PR)  | `assertProductionConfig()` runs at boot; refuses to start if any default secret / password / origin is unchanged.            |
| Swagger / OpenAPI explorer gated  | **Done** (this PR)  | `/api/v1/docs` is disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER=true` is explicitly set.                        |

---

## Step 10 — Staged Deployment

Detailed runbook in [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md).
The short version:

1. Deploy commit to **staging** (same Docker images, same env shape).
2. Run `pnpm --filter admin smoke` (Playwright) + `cd mobile && flutter test`.
3. Run a manual scan-attendance flow end-to-end with a real student + doctor account.
4. Pen-test staging with [OWASP ZAP](https://www.zaproxy.org/) baseline scan.
5. Promote image to **production** via the same `docker compose` / `kubectl rollout` command.
6. Watch logs + Sentry for 24h post-deploy.

---

## Accepted Risks

| #   | Risk                                               | Why accepted                                                                                                              | Compensating control                                                                                                         |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `next@14.2.x` patch-line CVEs (3 moderate, 2 high) | Full Next 15 upgrade requires App Router middleware audit; out of scope for the pilot.                                    | Bumped to latest `14.2.33`. SSRF / cache-poisoning bounded by per-route CSP + WAF.                                           |
| 2   | `bcryptjs` (pure JS, slower)                       | Cross-platform portability; native `bcrypt` adds a node-gyp build step and complicates Docker images on ARM.              | Cost factor 10 (≥ OWASP minimum). Refresh-token verify migrating to HMAC-SHA256 in PR #6 — no longer in the bcrypt hot path. |
| 3   | BLE beacon capture deferred on mobile              | Beacon fleet provider not yet selected. Backend accepts BLE proof but mobile only sends GPS + Wi-Fi BSSID today.          | Wi-Fi BSSID fallback ships with this branch and covers the underground-room case.                                            |
| 4   | No mobile-side certificate pinning                 | Production TLS terminates at the LB / WAF, which uses publicly-trusted CAs. Pinning would block legitimate cert rotation. | HSTS + WAF + per-app secret rotation policy.                                                                                 |

---

## Incident Response Plan

### Severity classification

| Severity  | Examples                                                                  | Response time                     |
| --------- | ------------------------------------------------------------------------- | --------------------------------- |
| **SEV-1** | Credential leak, RCE, mass data exfil, full outage                        | < 15 min ack, < 60 min mitigation |
| **SEV-2** | Single-tenant data exposure, partial outage, auth bypass affecting a role | < 1 h ack, < 4 h mitigation       |
| **SEV-3** | Non-exploitable vuln in dep tree, single-user data inconsistency          | < 1 business day                  |

### Who to notify

1. **On-call engineer** (paged via PagerDuty / Opsgenie).
2. **Security lead** (`security@saxony-egypt.edu`).
3. **CTO / product owner** for SEV-1 and SEV-2 within 1 hour.
4. **Affected tenants** (university IT admins) once the blast radius is known.
5. **GDPR / data-protection contact** within 72 hours if PII is involved (legal requirement).

### How to patch

1. **Contain.** Rotate compromised credentials immediately (`secrets` runbook). Revoke all refresh-token families for affected users: `UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "userId" IN (...)`.
2. **Eradicate.** Land the fix in a branch named `hotfix/SEV-<n>-<short-name>`. Skip the normal review queue but require one security-lead approval.
3. **Recover.** Tag the release, deploy to staging, run the smoke + pen-test, then promote to production. Verify with the original PoC that the issue is gone.
4. **Post-mortem.** Within 5 business days. Blameless format: timeline, root cause, contributing factors, action items with owners. Filed in `docs/postmortems/YYYY-MM-DD-<slug>.md`.

### How to inform users

1. **In-app banner** via `notifications.service.broadcast` (admin-only) for impacted tenants.
2. **Email** to each affected user's primary contact within 72 hours for any PII exposure (GDPR).
3. **Status page** (`status.saxony-egypt.edu`) updated for any production outage > 5 minutes.
4. **Public disclosure** for SEV-1 with patched release notes once the fix is live everywhere.

---

## Final deployment command

See [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) for the full
deploy + verify + rollback flow. The short version:

```bash
# 1. Build + push images (CI)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t registry.example.edu/smart-campus-backend:$(git rev-parse --short HEAD) \
  -f backend/Dockerfile --push .

# 2. Promote to staging
ssh staging.example.edu "cd /opt/smart-campus && \
  IMAGE_TAG=$(git rev-parse --short HEAD) docker compose pull && \
  docker compose up -d --no-deps backend && \
  curl -sf https://api-staging.example.edu/api/v1/health"

# 3. Run smoke tests against staging
pnpm --filter admin smoke -- --base-url=https://admin-staging.example.edu

# 4. Promote to production (same image tag)
ssh prod.example.edu "cd /opt/smart-campus && \
  IMAGE_TAG=$(git rev-parse --short HEAD) docker compose pull && \
  docker compose up -d --no-deps backend"

# 5. Watch logs for 5 minutes
ssh prod.example.edu 'docker compose logs -f backend' | tee deploy-$(date +%s).log
```
