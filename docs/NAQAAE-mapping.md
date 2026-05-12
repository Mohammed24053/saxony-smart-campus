# NAQAAE Standard → Saxony Smart Campus Feature Mapping

> Maps the Egyptian **National Authority for Quality Assurance and
> Accreditation of Education** (NAQAAE / الهيئة القومية لضمان جودة التعليم
> والاعتماد) institutional standards to concrete features and evidence
> artefacts in this platform.
>
> Use it as the "compliance-ready" appendix to your faculty
> self-evaluation report (تقرير الدراسة الذاتية).

## How to read this table

- **Standard** — short label for the relevant NAQAAE clause.
- **What it asks for** — paraphrase of the auditor's question.
- **Where it lives in the product** — feature / module / report.
- **Evidence artefact** — exactly what to drop into the binder.

## 1. Institutional management & governance

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 1.1 Defined roles & responsibilities | Documented separation of admin / instructor / student access. | RBAC: `super_admin`, `admin`, `doctor`, `student` enforced in `roles.guard.ts`. | Screenshot of the Users page filtered by role + the `RolesGuard` source. |
| 1.2 Data security & residency | PII stored on infrastructure under institutional control. | Self-host option on Egyptian cloud; full row-level isolation by `universityId`. | DPA template (`docs/DPA-template.md`) + infra topology diagram. |
| 1.3 Audit trail of administrative actions | Tamper-evident log of who did what. | `AuditLog` table + `audit-log` admin page (read-only). | CSV export of the last semester's audit-log entries. |

## 2. Teaching & learning quality

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 2.1 Attendance tracking per session | Verifiable record of which student attended which session. | `AttendanceSession` + `AttendanceRecord`, rotating-HMAC QR + GPS/Wi-Fi/BLE verification chain. | Per-session attendance export from the admin Attendance page. |
| 2.2 Punctuality monitoring | Distinction between "present" and "late". | `lateAfterMinutes` configurable per session; `AttendanceRecord.status ∈ {present, late, absent}`. | Aggregate late-rate report from Analytics → Attendance trends. |
| 2.3 Anti-fraud measures | Reasonable controls against proxy attendance. | Rotating-HMAC tokens (30s window) + 5-step verification (QR, session, enrolment, location, idempotency) + device-fingerprint rate-limit. | Architecture excerpt from `PROJECT_REVIEW.md` §"Attendance verification" + audit-log entries showing rejected scans. |

## 3. Student support services

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 3.1 Early identification of at-risk students | Mechanism to spot students likely to fail attendance / academic threshold. | Bull queue `at-risk` processor + admin At-Risk page (`AtRiskFlag` table). | Snapshot of the At-Risk dashboard + sample notification template. |
| 3.2 Timely communication channels | Push / in-app notifications to students. | FCM push + in-app notifications + `NotificationsHistory` page. | Screenshots of an outbound notification + delivery log. |
| 3.3 Multilingual access | UI accessible in Arabic and English. | i18n on admin (`useT()`) + mobile (`AppStrings`); full RTL flip on `Locale('ar')`. | Side-by-side AR/EN screenshots of the student home, scan, profile. |

## 4. Faculty & doctor workflow

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 4.1 Schedule transparency | Each instructor sees their own teaching schedule. | `GET /me/schedule/today` + Doctor Home Screen. | Screenshot of the doctor app showing today's lectures. |
| 4.2 Session start/end timestamping | Auditable session lifecycle. | `AttendanceSession.startedAt`, `closedAt`, recorded immutably. | Per-session detail export. |

## 5. Reporting & analytics

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 5.1 Periodic attendance reports | Reports per course / per cohort / per semester. | Admin Attendance + Analytics pages with date-range filters. | PDF / CSV exports for the auditor period. |
| 5.2 Trend analysis | Multi-semester comparisons. | Persisted `presentCount` / `lateCount` / `absentCount` on `AttendanceSession`. | Trend chart export from Analytics. |

## 6. Operational resilience

| Standard | What it asks for | Where it lives | Evidence artefact |
|---|---|---|---|
| 6.1 Backup & recovery procedures | Documented backup cadence. | (Operator responsibility — backed up daily via `pg_dump` cron, see runbook.) | Backup runbook + last restore-drill report. |
| 6.2 Incident response | Documented playbook for outages. | (Operator responsibility — `docs/incident-response.md`, follow-on PR.) | Incident-response doc + post-mortem template. |

## Notes for the self-evaluation report (التقرير الذاتي)

1. NAQAAE auditors prefer **screenshots dated within the audit period**
   over architecture diagrams — every "Evidence artefact" cell above
   should be a fresh export, not a static asset.
2. Where this mapping says "Operator responsibility", that's outside
   the application — it lives in your IT department's runbooks. Include
   them in the binder.
3. Keep the binder bilingual: every export label should appear in
   Arabic + English so the AR-only reviewer can find it.

## Gaps we know about

These items aren't shipped yet and need to land before a real NAQAAE
audit (not blockers for a paid pilot, but blockers for full
institutional accreditation):

- **Course-learning-outcome (CLO) mapping** — no model in the schema
  for ILOs / CLOs / programme-LOs. Out of scope for v1.
- **Examination management** — attendance only; no exam-results
  integration. Out of scope for v1.
- **Grievance / appeals workflow** — no in-app channel; lives in the
  faculty's existing process today.

The mapping above is therefore *attendance-and-engagement scoped*; it
covers the slice of NAQAAE the pilot will be evaluated against, not
the full SCU framework.
