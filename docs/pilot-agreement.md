# Design-Partner Pilot Agreement — Template

> Use as the cover agreement for the **single unpaid design-partner
> faculty** that runs a full semester of Saxony Smart Campus in
> exchange for a co-authored case study.
>
> Not legal advice. Have your counsel and the faculty's legal office
> review before signature.

## 1. Parties

- **Faculty**: _____________________________________________________________ ("the Design Partner").
- **Vendor**: _____________________________________________________________ (Saxony Smart Campus operator, "we").
- **Pilot start date**: ____________________________________________________.
- **Pilot end date**: _____________________________________________________ (one full academic semester).

## 2. Scope of the pilot

The Design Partner deploys Saxony Smart Campus across **(N) sections /
(M) students / (K) doctors** for the duration of one academic
semester. The platform is configured for:

- ✅ Attendance capture (QR + GPS / Wi-Fi / BLE).
- ✅ Doctor "Start lecture" workflow.
- ✅ Student push notifications.
- ✅ At-risk detection (informational only — no automated student
  actions in the pilot).
- ✅ Arabic + English UI.

Out of scope: exam management, LMS, grade-book, finance / payments.

## 3. Commercials

This pilot is **unpaid**. The Vendor provides the software, support,
and integration effort at no cost. In exchange, the Design Partner
grants:

1. Permission to **publish a case study** at the end of the pilot
   (§5).
2. **Reference rights** — the Vendor may mention the Design Partner
   by name in sales materials.
3. A **closing executive interview** (≤ 60 min) at semester end.

## 4. Success metrics

Tracked weekly in a shared dashboard, with the Vendor's analytics
team co-reviewing monthly. Success thresholds (must be met for the
case study to be published "successful"):

| Metric | Target | Source |
|---|---|---|
| Student adoption (% of enrolled who scan ≥ once / week) | ≥ 80 % | Analytics → Adoption |
| Doctor "Start lecture" rate (% of scheduled lectures started in-app) | ≥ 70 % | Analytics → Doctor activity |
| Median scan latency | < 800 ms p95 | Server-side telemetry |
| Proxy-attendance attempts blocked (vs control) | ≥ 50 % reduction | Comparison vs prior semester sign-in sheets (manual) |
| Push deliverability | ≥ 95 % | FCM dashboard |
| At-risk students flagged in week ≥ 4 | ≥ 1 | At-Risk page |

A monthly checkpoint document captures movement on every metric and
any blockers raised by the Design Partner.

## 5. Case-study deliverable

At the end of the pilot, the Vendor drafts a **co-authored 4-page case
study** (see `docs/case-study-skeleton.md` for the structure). The
Design Partner reviews and approves before publication.

The Design Partner has **15 business days** to request edits. If no
response is received within that window the document is deemed
approved.

The case study covers:

- Pilot setup (institution profile, scope, timeline).
- Success metrics with measured values.
- Three "what surprised us" findings (one positive, one neutral, one
  challenge the Vendor has since fixed).
- Two quotable testimonials (one student, one doctor) — opt-in by
  the individual.
- A forward-looking section on what comes after the pilot.

## 6. Support commitments

| Item | Commitment |
|---|---|
| Onboarding workshop | 1 × 2-hour session for admins, 1 × 1-hour for doctors, 1 × 30-min for student reps |
| Slack / WhatsApp support channel | < 4 h response, business hours, working days |
| Bug-fix SLA | P0 (production down): 24 h; P1 (workflow broken): 5 business days |
| Monthly steering call | 1 × 60 min, Design Partner academic lead + Vendor PM |

## 7. Data handling

All Personal Data processing happens under the DPA in
`docs/DPA-template.md`. Production data is hosted in Egypt by default.

## 8. Termination

Either party may terminate at any time with 30 days notice. On early
termination:

- Vendor exports all Design Partner data to a portable format (CSV /
  JSON) and deletes the production copy within 60 days (per the DPA).
- Vendor does **not** publish a case study unless both parties agree
  to a "lessons learned" variant.

## 9. Confidentiality

Pilot performance data is confidential to both parties until the case
study is published. Vendor may discuss the engagement in private
sales conversations (NDA-covered) before publication.

## 10. Intellectual property

The platform IP remains with the Vendor. Any configurations, data,
and student records remain the property of the Design Partner.

## 11. Limitation of liability

The Vendor's aggregate liability under this pilot agreement is
**capped at EGP 100,000** for the duration of the pilot. Personal
injury / wilful misconduct / IP infringement are excluded from the
cap.

## 12. Governing law

Egyptian law; Cairo courts.

---

## Signatures

| Party | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Design Partner** | | | | |
| **Vendor** | | | | |
