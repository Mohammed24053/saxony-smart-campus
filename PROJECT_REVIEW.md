# Saxony Smart Campus — Project Review

**Date:** 2026-05-03
**Reviewer:** Devin (audit only — no code changed)
**Scope:** backend (NestJS) + admin web (Next.js) + mobile (Flutter) + docs/CI

---

## TL;DR

The system has a **strong skeleton** — multi-tenant, RS256 JWT, refresh rotation,
TOTP 2FA, atomic Redis idempotency, GPS+QR attendance, Bull queues, Socket.io,
Prisma soft-delete, error registry, design system on both surfaces.

What's missing or broken splits roughly into:

| Bucket | Count | Examples |
| --- | --- | --- |
| **P0 — Real bugs / security gaps** | 8 | cross-tenant leak risk in `notifications.user`, no token-theft detection, mobile FCM not wired, doctor side has no entry point, etc. |
| **P1 — Missing features users will hit immediately** | 14 | password reset, /me endpoint, Doctors/Rooms/Subjects/Sections CRUD UIs, settings page, FCM token registration, Arabic translation strings, audit log, ... |
| **P2 — Important but deferrable** | 12 | exports (CSV/PDF reports), audit log UI, dark mode, command palette, drag-to-reschedule, biometric login, leave/excuse requests, offline cache, ... |
| **Nice** | 9 | Bull-Board UI, exam mode, grades, tablet layouts, observability, k8s manifests, CHANGELOG, ... |

Test coverage is thin: **7 backend specs (~51 unit tests), 0 admin tests, 0 mobile tests.**

---

## P0 — Real bugs and security gaps

### 1. Cross-tenant notification leak risk
`notifications.service.resolveRecipients` for `targetType=user` looks up the
target by ID without filtering by `universityId`. If two universities both have
a user UUID collision (extremely rare, but possible if IDs are guessed/leaked),
admin A could push to user in tenant B. Even without collision, the audit trail
won't show a tenant violation if the target is ever renamed.
**Fix (small):** add `universityId: uni` to the `where` clause.

### 2. No refresh-token-theft detection
We rotate refresh tokens but never **detect re-use of a stale (already-rotated)
token**. Standard practice: when a stale refresh hash is presented, revoke the
entire token family (all sibling refresh hashes for that user). Without this,
a stolen token grants permanent access until it organically expires (7 days).
**Fix (medium):** add `tokenFamilyId` to `RefreshToken`, treat re-use of a
revoked sibling as theft → revoke the family + emit `security.token_theft`.

### 3. Mobile never registers an FCM token
`firebase_messaging` isn't even in `pubspec.yaml`, and there is no init code,
no `getToken()` call, no API endpoint to upload it. Backend code at
`notifications.service.ts:22-26` reads `user.fcmToken` and pushes — but every
mobile user has `fcmToken=null`. **All push notifications are no-ops in
production today.**
**Fix (medium):** add `firebase_messaging`, request notification permission,
register on login, upload to a new `POST /me/push-token` endpoint, refresh on
token-rotation events.

### 4. Mobile doctor side has no entry point
`/doctor/active` route requires `subject/section/room` strings via `state.extra`
— but **nothing in the mobile app navigates to that route**. Doctors literally
cannot start a lecture from the app. Backend has `POST /attendance/session/start`,
mobile does not call it.
**Fix (medium):** add a doctor-aware home screen (today's slots, "Start lecture"
buttons), gate by `authProvider.role === 'doctor'`, hit `/attendance/session/start`,
push the active session screen with the returned `sessionId`.

### 5. No `/me` endpoint anywhere
No way for either surface to fetch the current user's profile, role,
permissions, or university metadata. After token refresh the client only has
the JWT claims; if the user is renamed/disabled server-side, the UI keeps the
stale state.
**Fix (small):** add `GET /me` returning the user + university summary.
Mobile + admin should call it on app start and after every refresh.

### 6. `lateAfterMinutes` is never settable
Backend has the field on `AttendanceSession`, the schema defaults it to 10,
but `StartSessionDto` doesn't accept it and the controller doesn't pass it.
Doctors who want a stricter or looser tardy window can't configure it.
**Fix (small):** add to DTO + service.

### 7. `endSession` fires absentees event but doesn't materialise final stats
Counts are recomputed from records every time anyone asks. After
`markAbsentees` adds dozens of rows, the next 5 dashboard hits each rerun the
same aggregation. For 200-student lectures this is expensive.
**Fix (small):** persist `presentCount/lateCount/absentCount` on
`AttendanceSession` at close time, expose via `GET /session/:id/report`.

### 8. Admin `/auth/logout` body is enforced; mobile session restore is silent
After a previous session, the auth store re-uses tokens from secure storage but
never validates them against the server. If access+refresh both expired (e.g.
phone offline 2 weeks), the user lands on Home, every API call 401s, and the
app re-routes to login — but only after a frustrating loading flash. Should
soft-validate on boot via `GET /me`.

---

## P1 — Missing features users will hit immediately

### Backend
| # | Feature | Why it matters | Effort |
| --- | --- | --- | --- |
| B1 | **Password reset flow** (forgot password → email link → reset) | Today the only way to recover an admin password is to re-seed via shell. Doctors and students literally cannot reset their own. | M |
| B2 | **`/me` endpoint** (mentioned above) | Required by both clients. | S |
| B3 | **`POST /me/push-token`** + push-token table | Without it, FCM is dead. | S |
| B4 | **Users CRUD module** for admins | Today only the seeded admin exists; no way to add a second one through the UI. | M |
| B5 | **Bulk import for doctors / sections / subjects / rooms** | Students have it; the others must be entered one-by-one which is painful in setup. | M |
| B6 | **Excused absence / leave request endpoints** | A student needs to submit a doctor's note; today only manual override by the lecturer exists. | M |
| B7 | **Audit log** (every CUD operation) | Compliance/forensics; required for any university IT review. | M |
| B8 | **University settings** (school year, week start, default thresholds, logo) | Hard-coded today. | S |
| B9 | **Reports endpoints**: per-session, per-subject, per-section attendance reports as CSV / PDF | Faculty offices ask for printable reports. | M |
| B10 | **Email service** (SMTP / SES) for password reset, welcome, weekly summaries | Firebase only sends push. | M |

### Admin web
| # | Feature | Why it matters | Effort |
| --- | --- | --- | --- |
| A1 | **CRUD UIs for Doctors, Rooms, Subjects, Sections** | All four pages are read-only tables today. Backend has full CRUD. | M (4 forms + 4 confirm-modals) |
| A2 | **Settings page** (university config, threshold defaults, branding) | No way to configure the system without writing SQL. | M |
| A3 | **Users management page** (list/create/edit/disable admins) | One admin only today. | M |
| A4 | **Profile page** (edit own info, enable/disable 2FA, sessions list, "log out from all devices") | API for 2FA exists; no UI. | M |
| A5 | **Forgot password screen** (paired with B1) | | S |
| A6 | **Localization (en/ar)** with RTL flip | Strings are hard-coded English. SEU is an Egyptian university; Arabic is the primary language for many users. | L |
| A7 | **Notifications history page** (list of past sent notifications + delivery stats) | Composer-only today; can't see which were delivered. | M |
| A8 | **Excel/CSV export** on Students, Attendance live, At-Risk | Excel-in-only, no Excel-out. | S |
| A9 | **Sidebar collapse** to icon-only rail | Spec called for it; not built. | XS |
| A10 | **Empty-state CTAs** on every list page (e.g., "No students yet → Import Excel") | Onboarding friction. | S |

### Mobile
| # | Feature | Why it matters | Effort |
| --- | --- | --- | --- |
| M1 | **Arabic translations + content RTL** | Locale toggle exists but every string is hard-coded English. | L |
| M2 | **FCM init + token registration + foreground/background handlers + deep links** | Critical to "smart campus" identity — push is the differentiator. | M |
| M3 | **Forgot-password link on login** | Pairs with B1. | S |
| M4 | **Doctor home + "Start lecture" flow** | Half the user base today can't use the app. | M |
| M5 | **Profile screen with `GET /me` + edit + log out from all + change password + biometric toggle** | Profile screen is a static stub today. | M |
| M6 | **Offline cache** for schedule + last-7-days history; OfflineBanner is present but never wired to connectivity changes | Network on Egyptian campuses isn't always good. | M |

---

## P2 — Important but deferrable

| # | Item | Where | Effort |
| --- | --- | --- | --- |
| P2-1 | **Bull-Board** dashboard for visualising notification + at-risk queues | backend | S |
| P2-2 | **Health check upgrade** to `@nestjs/terminus` (DB + Redis + MinIO probes) | backend | S |
| P2-3 | **Sentry / OpenTelemetry** for error reporting + tracing | backend + admin + mobile | M |
| P2-4 | **Structured logs** (pino + request-id) | backend | S |
| P2-5 | **Dark mode** on admin web (tokens already support it; just need a toggle + theme provider) | admin | S |
| P2-6 | **Command palette** (Cmd+K → search across students/doctors/rooms/subjects, jump to settings) | admin | M |
| P2-7 | **Drag-to-reschedule** on the schedule grid | admin | M |
| P2-8 | **Biometric login** (Face/Touch ID) — UI hint exists, not wired | mobile | S |
| P2-9 | **Tablet layouts** for mobile | mobile | M |
| P2-10 | **Conflict resolution UI** for schedule (today we pulse but don't help fix) | admin | M |
| P2-11 | **Sortable / column-pinned tables** (currently we render but don't sort client-side beyond default order) | admin | S |
| P2-12 | **Storybook-equivalent** route for QA | admin | S |

---

## Nice-to-haves (future)

- **Exam mode**: separate session type, no GPS, longer late window.
- **Grades / marks module**: already a natural extension of the section model.
- **Onboarding wizard**: first-run setup of faculty → year → section → subject hierarchy.
- **Gamification**: streaks, attendance leaderboards (opt-in), badges.
- **Self-service signup** for new universities (today the seed creates one).
- **Section captain role**: sub-admin permissions per section.
- **Database row-level security** (Postgres RLS) — defence in depth on top of service-layer filters.
- **CHANGELOG + release process** (Conventional Commits → release-please).
- **Threat model + DSAR / GDPR procedure** doc.

---

## Test coverage

| Surface | Spec files | Approx tests | Recommendation |
| --- | --- | --- | --- |
| Backend | 7 | 51 unit | Add e2e tests for: auth login + 2FA, scan happy/sad paths, end session → at-risk, notification fan-out |
| Admin web | 0 | 0 | Add Playwright smoke for: login, dashboard renders, students table, filter/search, send notification |
| Mobile | 0 | 0 | Widget tests for: login, scan states, lecture card, offline banner |

---

## Quick wins (low-effort, high-impact)

These are 1-day-or-less items that disproportionately improve the system:

1. Add `GET /me` endpoint (P0-5 / B2).
2. Add `lateAfterMinutes` to `StartSessionDto` (P0-6).
3. Persist final session counts at close (P0-7).
4. Add `universityId` filter to `notifications.user` lookup (P0-1).
5. Fix sidebar collapse on admin (A9).
6. Excel/CSV export buttons on admin lists (A8).
7. CRUD modals for Doctors/Rooms/Subjects/Sections (A1) — same pattern × 4.
8. Empty-state CTAs (A10).
9. Bull-Board mount at `/admin/queues` (P2-1).
10. `@nestjs/terminus` health check (P2-2).

If you greenlight just these 10, the system goes from "demo-ready" to "pilot-ready"
in roughly **2-3 working days**.

---

## Pilot-blockers vs nice-to-haves

If the goal is **a real pilot at one faculty next semester**, the *minimum*
must-fix list is:

- **All P0 items** (8) — these are real defects.
- **B1, B3, B4, A1, A6, M1, M2, M4, M5** — without these the system is unusable
  for anyone other than a single seeded admin demoing on stage.

Everything else can land progressively in patch releases.

---

## Pending operational issues (not code)

- **GitHub Actions CI is environmentally blocked** since project inception
  (`BlobNotFound` on log retrieval = runner never starts; same fingerprint as a
  GitHub billing lock). Local validation is fully green every time. You need to
  resolve the billing block at https://github.com/settings/billing.
- **Mobile end-to-end testing requires a real device or emulator** (no Flutter
  SDK + no emulator on the build VM). I can write code, you must run it.
