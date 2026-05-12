/**
 * Saxony Smart Campus — Attendance Scan Load Test
 *
 * Target: 5 000 concurrent `POST /attendance/scan` from unique student
 * devices against a single Postgres + Redis pair (the pilot-faculty
 * deployment topology).
 *
 * Workload model
 *   - The realistic case is "5 000 students scan within ~60s of the
 *     doctor going live" — a peak arrival burst, not 5 000 VUs
 *     hammering forever.
 *   - setup() boots a real doctor session with a long QR rotation
 *     window (so the same payload is valid for the whole run) and
 *     hands the qrPayload to every VU.
 *   - Each iteration logs in (cached per-VU) and POSTs ONE scan,
 *     then exits. per-vu-iterations: 1 + shared-iterations means
 *     exactly N scans hit the backend across the test.
 *
 * Stage profile (default — override via env)
 *   peak_arrival   ramp 0 → VUS over RAMP_UP, hold for STEADY,
 *                  drain over RAMP_DOWN. Each VU scans once.
 *
 * SLO thresholds (test fails if breached)
 *   - p(95) scan latency < 800ms
 *   - error rate < 1%
 *   - scan_ok rate > 99%
 *
 * Pre-run
 *   pnpm --filter backend run seed
 *   pnpm --filter backend exec ts-node ../load/k6/seed.ts --count 5000
 *
 * Run
 *   BASE_URL=http://localhost:3000/api/v1 k6 run load/k6/scan.js
 *
 * Smoke-test variant (validates the script without burning a real run):
 *   VUS=10 RAMP_UP=10s STEADY=20s RAMP_DOWN=5s k6 run load/k6/scan.js
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000/api/v1";
const VUS = Number(__ENV.VUS || 5000);
const RAMP_UP = __ENV.RAMP_UP || "2m";
const STEADY = __ENV.STEADY || "5m";
const RAMP_DOWN = __ENV.RAMP_DOWN || "1m";
const DOCTOR_EMAIL = __ENV.DOCTOR_EMAIL || "loadtest.doctor@saxony-egypt.edu";
const DOCTOR_PASSWORD = __ENV.DOCTOR_PASSWORD || "LoadTest!2025";
const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || "LoadTest!2025";

export const options = {
  scenarios: {
    classroom_scan_storm: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || "10m",
    },
  },
  thresholds: {
    // Scope the latency SLO to the scan POST itself — login is
    // bcrypt-bound and slow by design, and isn't what the SLO is
    // about. The scan_latency_ms trend is a parallel scan-only
    // metric for the case-study attachment.
    "http_req_duration{endpoint:scan}": ["p(95)<800", "p(99)<2000"],
    "http_req_failed{endpoint:scan}": ["rate<0.01"],
    "checks{scan_ok:true}": ["rate>0.99"],
    scan_latency_ms: ["p(95)<800"],
  },
};

// Pre-seeded students — k6 SharedArray is loaded once and shared
// across VUs. The CSV is produced by backend/scripts/k6-seed.ts;
// if missing we fall back to synthesised rows so the script still
// runs as a syntax-check smoke without a seeded DB.
let CSV_RAW = "";
try {
  // open() is a top-level k6 builtin; it throws if the path is missing.
  CSV_RAW = open("./data/students.csv");
} catch (_) {
  CSV_RAW = "";
}
const students = new SharedArray("students", () => {
  if (CSV_RAW) {
    return CSV_RAW.split("\n")
      .slice(1) // header
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const [email, password, studentId] = line.split(",");
        return { email, password, studentId };
      });
  }
  const synth = [];
  for (let i = 1; i <= VUS; i++) {
    synth.push({
      email: `loadtest+${i}@saxony-egypt.edu`,
      password: STUDENT_PASSWORD,
      studentId: `LOAD-STU-${i}`,
    });
  }
  return synth;
});

const scanOk = new Rate("scan_ok");
const scanLatency = new Trend("scan_latency_ms");
const scanRejected = new Counter("scan_rejected");

export function setup() {
  // 1. Backend reachable? /health is mounted under the same /api/v1 prefix.
  const health = http.get(`${BASE_URL}/health`);
  check(health, { "backend reachable": (r) => r.status === 200 });
  if (health.status !== 200) {
    throw new Error(
      `backend health check failed (status=${health.status}). Run the seed script first.`,
    );
  }

  // 2. Log in as the load-test doctor (pre-seeded by load/k6/seed.ts).
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (loginRes.status !== 200) {
    throw new Error(
      `doctor login failed (status=${loginRes.status}, body=${loginRes.body}). ` +
        "Did you run `pnpm --filter backend exec ts-node ../load/k6/seed.ts` first?",
    );
  }
  const doctorToken = loginRes.json("data.accessToken");

  // 3. Find the doctor's slot for today via /me/schedule/today.
  const sched = http.get(`${BASE_URL}/me/schedule/today`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });
  const items = sched.json("data.items") || sched.json("data") || [];
  if (!items.length) {
    throw new Error(
      "no schedule slot for the load-test doctor today. Re-run load/k6/seed.ts.",
    );
  }
  const slotId = items[0].id;

  // 4. Start a session with a long rotation window so the same QR
  //    payload is valid for the whole run. If a previous run left a
  //    session active, end it via the doctor's active slot first.
  let startRes = http.post(
    `${BASE_URL}/attendance/session/start`,
    JSON.stringify({ scheduleSlotId: slotId, intervalSeconds: 7200 }),
    {
      headers: {
        Authorization: `Bearer ${doctorToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (startRes.status === 409) {
    // SESSION_ALREADY_ACTIVE — find + end it, then retry.
    const existing = http.get(`${BASE_URL}/attendance/sessions?status=active`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const open = (existing.json("data") ||
      existing.json("data.items") ||
      [])[0];
    if (open && open.id) {
      http.post(`${BASE_URL}/attendance/session/${open.id}/end`, null, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
    }
    startRes = http.post(
      `${BASE_URL}/attendance/session/start`,
      JSON.stringify({ scheduleSlotId: slotId, intervalSeconds: 7200 }),
      {
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          "Content-Type": "application/json",
        },
      },
    );
  }
  if (startRes.status !== 200 && startRes.status !== 201) {
    throw new Error(
      `session/start failed (status=${startRes.status}, body=${startRes.body})`,
    );
  }
  const data = startRes.json("data") || {};
  const session = data.session || {};
  return {
    sessionId: data.id || session.id,
    qrPayload: data.qrPayload || data.qr,
    doctorToken,
  };
}

export default function (ctx) {
  if (!ctx || !ctx.qrPayload) return;
  const idx = (__VU - 1) % students.length;
  const me = students[idx];

  const token = login(me);
  if (!token) {
    scanRejected.add(1);
    return;
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Lecture Hall A is at 30.0444, 31.2357. Jitter inside the 50m radius.
  const t0 = Date.now();
  const scanRes = http.post(
    `${BASE_URL}/attendance/scan`,
    JSON.stringify({
      payload: ctx.qrPayload,
      gpsLat: 30.0444 + Math.random() * 0.0002,
      gpsLng: 31.2357 + Math.random() * 0.0002,
      deviceFingerprint: `vu-${__VU}`,
    }),
    { headers, tags: { endpoint: "scan" } },
  );
  scanLatency.add(Date.now() - t0);

  // 200 = first successful scan. 409 ALREADY_REGISTERED = idempotent
  // retry, still considered OK from the load-test perspective.
  const ok = check(
    scanRes,
    {
      "scan accepted (200) or ALREADY_REGISTERED (409)": (r) =>
        r.status === 200 || r.status === 409,
    },
    { scan_ok: true },
  );
  scanOk.add(ok);
  if (!ok) scanRejected.add(1);

  // per-vu-iterations: 1 means we exit here. No sleep needed.
}

export function teardown(ctx) {
  if (!ctx || !ctx.sessionId || !ctx.doctorToken) return;
  http.post(`${BASE_URL}/attendance/session/${ctx.sessionId}/end`, null, {
    headers: { Authorization: `Bearer ${ctx.doctorToken}` },
  });
}

const tokenCache = {};
function login(me) {
  if (tokenCache[me.email]) return tokenCache[me.email];
  const r = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: me.email, password: me.password }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "login" },
    },
  );
  if (r.status !== 200) return null;
  const tok = r.json("data.accessToken");
  if (tok) tokenCache[me.email] = tok;
  return tok;
}
