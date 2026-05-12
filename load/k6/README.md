# k6 load test — `POST /attendance/scan` × 5 000 concurrent VUs

This package is the load-test harness referenced by the pilot-readiness
checklist ("Load-tested to 5k concurrent scans on a single Postgres +
Redis pair").

## What it tests

- 5 000 virtual users (one per student device) hitting
  `POST /attendance/scan` over a 5-minute steady-state window with a
  realistic 30-second cadence per device.
- p95 < 800 ms / p99 < 2 000 ms / error rate < 1 % thresholds — k6
  fails the run if any are breached.
- Uses a single Postgres + Redis pair (the pilot deployment topology).

## Local quick-start (without Docker)

```bash
# 1. Boot backend, postgres, redis as usual
pnpm install
pnpm --filter backend prisma:migrate
pnpm --filter backend run seed
pnpm --filter backend run start

# 2. (Once) bulk-seed 5 000 students via the script you maintain.
#    Example: ts-node load/k6/seed.ts --count 5000

# 3. Run k6
BASE_URL=http://localhost:3000/api/v1 \
  SESSION_ID=session-load-test \
  k6 run load/k6/scan.js
```

## With docker-compose

```bash
./scripts/generate-keys.sh           # writes JWT_PRIVATE_KEY/JWT_PUBLIC_KEY
docker compose -f docker-compose.loadtest.yml up --abort-on-container-exit
docker compose -f docker-compose.loadtest.yml down -v
```

The k6 container reports a summary to stdout and writes `summary.json`
to `load/k6/summary.json` for the case-study attachment.

## Tuning

| Var          | Default            | Meaning                                            |
|--------------|--------------------|----------------------------------------------------|
| `VUS`        | `5000`             | Steady-state concurrent virtual users.             |
| `RAMP_UP`    | `2m`               | Time to climb from 0 to `VUS`.                     |
| `STEADY`     | `5m`               | Time held at `VUS`.                                |
| `RAMP_DOWN`  | `1m`               | Time to drain back to 0.                           |
| `SESSION_ID` | `session-load-test`| The seeded AttendanceSession ID to scan against.   |

## Caveats

- The current `setup()` fabricates student credentials. Replace
  `load/k6/data/students.csv` with a real CSV (one `email,password,studentId`
  per line) if your auth flow rejects synthetic accounts.
- Run k6 from a machine outside the backend VM — co-located runs measure
  IPC, not real production network latency.
