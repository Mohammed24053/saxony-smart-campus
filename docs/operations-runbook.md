# Pilot Operations Runbook

Audience: the faculty IT contact + the on-call engineer running the
design-partner semester. Not student-facing.

## 1. First-day bootstrap

Prerequisites: Docker, Node 20+, pnpm 9, openssl.

```bash
git clone https://github.com/Mohammed24053/saxony-smart-campus.git
cd saxony-smart-campus
cp .env.example .env
./scripts/generate-keys.sh                # writes RS256 keypair to backend/.env
docker compose up -d                       # postgres / redis / minio
pnpm install
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:deploy
pnpm --filter backend run seed             # creates the seeded admin
```

Seeded super-admin (change the password immediately after first login):

- email: `admin@saxony-egypt.edu`
- password: value of `INITIAL_ADMIN_PASSWORD` (defaults to `ChangeMe!2025`)

## 2. Import the faculty's student CSV

The faculty's SIS export should have a header row with at least
`email,studentId,name,sectionName` and optionally
`faculty,year,phone,password`.

```bash
# Sanity check the parse first.
pnpm --filter backend exec ts-node scripts/sis-import.ts \
  --file /path/to/students.csv --dry-run

# Then commit to the database.
pnpm --filter backend exec ts-node scripts/sis-import.ts \
  --file /path/to/students.csv
```

Re-runnable safely: existing emails are updated, never duplicated.
Passwords already in use are never overwritten. New rows get a default
password of `<studentId>!2025`; the pilot agreement requires students to
reset on first login.

## 3. Spin up the apps

```bash
# Terminal 1
pnpm --filter backend run start            # http://localhost:3000/api/v1

# Terminal 2
pnpm --filter admin run dev                # http://localhost:3001

# Terminal 3 (optional — only needed for QA on a real device)
cd mobile && flutter run
```

`/api/v1/health` returns 200 once the backend is ready. `GET /login` on
:3001 returns 200 once the admin is ready.

## 4. The doctor "Start lecture" flow

1. Doctor opens the mobile app, signs in.
2. The Today screen lists every `ScheduleSlot` whose `dayOfWeek` matches
   today, sorted by start time.
3. Tapping **Start lecture** on a slot:
   - Navigates to `/doctor/active` with `slotId` in the route extras.
   - Mobile POSTs `/attendance/session/start` with the slotId.
   - Backend returns `{ id, qrPayload, intervalSeconds }`.
   - Mobile renders the rotating QR and refreshes it every
     `intervalSeconds` (default 30s) via `GET /session/:id/qr`.
4. Tapping **End lecture** POSTs `/session/:id/end` and pops back to
   the Today screen. The session is now closed; subsequent scans of any
   payload from that session are rejected.

If the POST fails (network down, slot not found, etc.) the screen falls
back to a local demo ticker so the doctor isn't stranded.

## 5. The student attendance flow

1. Student opens the mobile app, signs in.
2. Tapping **Scan** opens the camera with a QR overlay.
3. Mobile reads the QR payload + GPS + (when available) Wi-Fi BSSID +
   nearby BLE beacons.
4. POST `/attendance/scan` with the QR payload + any of the proof
   fields. Backend verifies in priority order:
   - HMAC validity + time window (rejects replays > intervalSeconds old).
   - Location proof: GPS within Haversine radius **OR** Wi-Fi BSSID in
     the allow-list **OR** BLE beacon ID in the allow-list.
   - Device fingerprint uniqueness within session (no buddy-punching
     from a single phone).
5. Returns `{ status: "present" | "late" | "rejected" }`.

## 6. Operational dashboards

- **Admin → Dashboard** — total students, today's sessions, scanned vs
  expected counts.
- **Admin → Attendance** — per-session breakdown, late/present split,
  per-section attendance ratio.
- **Admin → Students** — search, pagination, CSV export (current
  filter), Excel import (one-shot, for the design-partner faculty this
  is replaced by the `sis-import.ts` script above).
- **Admin → Notifications** — broadcast / per-section composer with
  audience preview.

## 7. Backup + restore

Daily backup (cron from the host running docker):

```bash
docker exec campus-postgres pg_dump -U campus -d smart_campus \
  | gzip > /var/backups/smart-campus/$(date +%F).sql.gz

# Keep the last 14 days.
find /var/backups/smart-campus -mtime +14 -delete
```

Restore (full DB, after fresh `docker compose up`):

```bash
gunzip -c /var/backups/smart-campus/<date>.sql.gz \
  | docker exec -i campus-postgres psql -U campus -d smart_campus
```

Object storage (MinIO) is not backed up by `pg_dump`. Either mirror the
MinIO volume to S3 nightly, or accept that uploaded files are reset on
restore — the pilot does not yet rely on uploaded media being durable.

## 8. Rolling back a release

The backend uses Prisma migrations. Each PR adds an *additive* migration
(new tables / columns) so the previous backend version stays compatible.

To roll the **app code** back without rolling the DB schema back:

```bash
git checkout <previous-tag>
pnpm install
pnpm --filter backend prisma:generate
pnpm --filter backend run start
```

To roll a **destructive** migration back (rare — the pilot has none so
far), you need a hand-written down-migration. Add a `migration_down.sql`
to the relevant migration folder and apply it with `psql`. The
migration table (`_prisma_migrations`) must be updated to remove the
applied row; otherwise the rolled-back DB will reject the next deploy.

## 9. On-call diagnostics

| Symptom | First thing to check |
|---|---|
| Mobile app stuck on splash | `GET /api/v1/me` 401 — refresh cookie expired. User must re-login. |
| Doctor "Start lecture" does nothing | Backend logs for `attendance.session.start` — schedule slot probably belongs to a different doctor. |
| QR scans rejected as "expired" | Doctor's slot rotation window vs student device clock — check NTP on both. |
| Admin dashboard shows 0 sessions | Backend Bull queue `at-risk-detection` health — `redis-cli ping`. |
| FCM not delivering | `/me/push-token` POST 200 but no push — check Firebase service account env vars + Firebase project ID matches the mobile app. |
| `/auth/login` 401 with correct password | TOTP 2FA was turned on for that admin — bypass via the `INITIAL_ADMIN_PASSWORD` admin's recovery codes or seed a fresh admin. |
| 5xx wave under load | Check Postgres connections — Prisma default pool is 10 per worker. Raise via `DATABASE_URL?connection_limit=...`. |

## 10. Pilot success metrics (record weekly)

- Attendance scans / day (target: ≥80% of expected).
- Median time-to-mark-present from QR rotation (target: <5s).
- Rejected scans / total scans (target: <3%). Investigate every spike.
- Push-notification delivery rate (target: >95% in foreground).
- Doctor sessions started / scheduled (target: >90%).
- At-risk students flagged / week (no target — observed baseline only).
- Backend p95 latency on `/attendance/scan` (target: <250ms at 50 RPS).

Drop weekly numbers into `docs/case-study-skeleton.md` so the final
written case study writes itself at semester-end.
