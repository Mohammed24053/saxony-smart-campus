# Saxony Egypt — Smart Campus System

Multi-tenant SaaS platform for university operations: smart QR + GPS attendance,
AI-assisted schedule generation, at-risk student early detection, and unified
push notifications.

## Stack

| Surface          | Tech                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Backend          | NestJS 10 · Prisma 5 · PostgreSQL 16 · Redis 7 · Bull · Socket.io    |
| Admin web        | Next.js 14 (App Router) · TanStack Query · Tailwind · Recharts       |
| Mobile           | Flutter 3 · Riverpod · GoRouter · Dio · mobile_scanner · geolocator  |
| Storage          | MinIO (S3-compatible)                                                |
| Push / messaging | Firebase Admin (FCM) — no-ops gracefully when unconfigured           |
| CI               | GitHub Actions: typecheck + backend tests + admin build              |

## Repo layout

```
backend/   NestJS API (multi-tenant, Prisma, Bull queues, Socket.io)
admin/     Next.js 14 admin dashboard (port 3001)
mobile/    Flutter app (students + doctors)
docker-compose.yml   Postgres / Redis / MinIO for local dev
.env.example         All environment variables (placeholders)
scripts/   Helpers (RS256 keypair generator, etc.)
```

## Local development

### 0. Prerequisites

- Node 20+, pnpm 9
- Docker (for Postgres / Redis / MinIO)
- (Optional) Flutter 3.22+ to run the mobile app

### 1. Bootstrap

```bash
cp .env.example .env
./scripts/generate-keys.sh         # writes RS256 keypair into .env
docker compose up -d               # postgres / redis / minio
pnpm install
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
pnpm --filter backend run seed     # creates default admin
```

### 2. Run

```bash
pnpm --filter backend dev          # http://localhost:3000  (Swagger at /api/v1/docs)
pnpm --filter admin dev            # http://localhost:3001
```

### 3. Mobile

```bash
cd mobile
flutter create .                   # generates Android/iOS/Web platform projects
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Design system

The visual identity, colour tokens, motion specs, and reusable component
library are documented in [`docs/design-system.md`](docs/design-system.md).
The accessibility audit is in
[`docs/accessibility.md`](docs/accessibility.md). A live web showcase of
every primitive is mounted at [`/design-system`](http://localhost:3001/design-system)
in the admin dashboard.

## Default admin

```
email:    admin@saxony-egypt.edu
password: ChangeMe!2025                 # or $INITIAL_ADMIN_PASSWORD
```

## Architecture highlights

- **Multi-tenant** by `universityId` on every tenant-owned table.
  `TenantMiddleware` lifts the JWT `uni` claim onto `req.universityId`,
  every service filters by it.
- **Soft-delete** (`deletedAt`) on every tenant entity.
- **Standard response envelope** `{ success, data, meta }` via a global
  `TransformInterceptor`. Errors are normalised through `AppException`
  + 31-code error registry → `{ success: false, error: { code, message } }`.
- **Auth**: RS256 JWT (15m access / 7d refresh) with refresh-token rotation
  (bcrypt-hashed, revocable). TOTP 2FA for admins via `speakeasy`.
- **QR attendance**: rotating HMAC-SHA256 tokens (TOTP-style 30s windows).
  Scan endpoint runs a 5-step verification chain
  (token → enrolment → session active → GPS Haversine → idempotency).
  Live updates over Socket.io.
- **Schedule generator**: pure function (`schedule-generator.ts`) packs
  subjects into the week respecting doctor availability, room capacity,
  preferred room types, and conflict-free across doctors / rooms / sections.
- **At-risk detection**: Bull queue evaluates absence thresholds after
  every closed session; chooses warning level (warning_1 / warning_2 /
  deprivation) and triggers FCM + in-app + WebSocket notifications per
  `AtRiskSetting`.

## Tests

```bash
pnpm --filter backend test            # 49 unit tests
pnpm --filter backend test:cov        # with coverage
```

Coverage thresholds are intentionally permissive on this initial PR (the
backend ships with critical-path tests for QR HMAC, GPS, schedule planner,
auth login + 2FA, refresh-token rotation, attendance 5-step scan, at-risk
threshold evaluation). They should be ratcheted up in subsequent PRs.

## Out of scope (v1)

Grades · exam management · parent portal · web student portal ·
AI/ML academic prediction · ERP / LMS integration · payment ·
library · doctor evaluation · video conferencing · admin mobile app.
