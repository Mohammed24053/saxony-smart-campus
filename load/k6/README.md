# k6 load test — `POST /attendance/scan` × 5 000 students

This package is the load-test harness referenced by the pilot-readiness
checklist ("Load-tested to 5k concurrent scans on a single Postgres +
Redis pair").

## What it tests

- 5 000 student devices (one per VU) each hitting `POST /attendance/scan`
  exactly once during the test — the realistic "5k students scan when
  the lecture starts" pattern, not 5k VUs hammering forever.
- p95 scan latency < 800 ms, p99 < 2 000 ms, error rate < 1 % — k6
  fails the run if any threshold is breached.
- The thresholds are scoped to `endpoint:scan` so the login warm-up
  (bcrypt-bound) doesn't pollute them.

## Local quick-start

```bash
# 1. Boot backend, postgres, redis as usual
pnpm install
pnpm --filter backend prisma:migrate
pnpm --filter backend run seed
pnpm --filter backend run start

# 2. Seed N load-test students + the load-test doctor + slot.
#    Idempotent — re-run to top up. Writes
#    load/k6/data/students.csv consumed by the k6 SharedArray.
pnpm --filter backend exec ts-node scripts/k6-seed.ts --count 5000

# 3. Run k6 (single-machine smoke; see "Throttler caveat" below for 5k).
BASE_URL=http://localhost:3000/api/v1 k6 run load/k6/scan.js
```

## Validating the script with a low-VU run

The script's been validated end-to-end against a real seeded backend
at VUS=3:

```bash
BASE_URL=http://localhost:3000/api/v1 VUS=3 k6 run load/k6/scan.js
# → 3/3 scans accepted (status=200), scan_latency_ms p95 < 30 ms,
#    no threshold breaches.
```

Use this as the post-deploy sanity check before pointing k6 cloud at
the production-spec stack.

## With docker-compose

```bash
./scripts/generate-keys.sh           # writes JWT_PRIVATE_KEY/JWT_PUBLIC_KEY
docker compose -f docker-compose.loadtest.yml up --abort-on-container-exit
docker compose -f docker-compose.loadtest.yml down -v
```

The k6 container reports a summary to stdout and writes `summary.json`
to `load/k6/summary.json` for the case-study attachment.

## Tuning

| Var          | Default                          | Meaning                              |
|--------------|----------------------------------|--------------------------------------|
| `VUS`        | `5000`                           | Number of student VUs.               |
| `MAX_DURATION` | `10m`                          | Cap on the test duration.            |
| `BASE_URL`   | `http://localhost:3000/api/v1`   | Backend root (under the /api/v1 prefix). |
| `DOCTOR_EMAIL` | `loadtest.doctor@…`            | The seeded load-test doctor.         |
| `DOCTOR_PASSWORD` | `LoadTest!2025`             | Doctor password (set in k6-seed.ts).  |
| `STUDENT_PASSWORD` | `LoadTest!2025`            | Per-student password fallback.       |

## Throttler caveat (single-source-IP runs)

`POST /auth/login` is throttled at 5 req/min per IP (`AuthController`)
and the backend also keeps a per-IP Redis rate limit in
`AuthService.loginThrottle`. A 5 000-VU k6 run from a single source IP
will trip both limits during the login phase and never reach the scan
phase.

For an authentic 5k run, you have three options:

1. **Run k6 from k6 Cloud or a distributed runner** (most realistic) —
   each VU comes from a different egress IP, so per-IP throttles don't
   trip. This is the recommended production model.
2. **Temporarily widen the throttle** in the load-test environment by
   setting `LOAD_TEST=1` and patching `AuthService` / `AuthController`
   to skip rate limits in non-production environments. Do **not** ship
   this to a live tenant.
3. **Pre-issue student JWTs in setup()** by signing tokens with the
   backend's RS256 private key directly. Skips `/auth/login` entirely.
   This is the cleanest if you have access to the same key material.

The script as committed exercises the *full* student path (login →
scan) so latency budgets cover the realistic end-to-end. Most pilot
deployments will run the test from k6 Cloud anyway.

## Caveats

- The seed script uses `bcrypt(8)` for student passwords (instead of
  the production `bcrypt(12)`) so seeding 5 000 students finishes in
  under a minute. Production student passwords go through the normal
  `bcrypt(12)` path.
- Run k6 from a machine outside the backend VM — co-located runs
  measure IPC, not real production network latency.
