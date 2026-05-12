# Case Study — Skeleton

> Pre-canned outline for the design-partner semester case study.
> Replace bracketed placeholders with measured values from the shared
> dashboard at semester end.
>
> Target length: **~4 pages / 1 200–1 600 words**. Read time 6 minutes.
> Bilingual cover page (AR + EN). Body in EN with AR translations
> available on request.

---

## Front matter

- **Title**: How [Faculty Name] Cut Proxy Attendance by [N] % in One
  Semester with Saxony Smart Campus.
- **Subhead**: A design-partner pilot covering [N] students, [M]
  sections, and [K] doctors across one academic semester at
  [University].
- **Date**: [Month Year].
- **Pull-quote** (front cover): "[A single sentence from the dean.]"

## 1. Why this faculty signed up (200 words)

- Institutional context: size, mission, faculty profile.
- Prior pain points (paper sign-in sheets, no late-rate visibility,
  buddy punching).
- Why they chose us over the alternatives (anti-fraud chain, Arabic-
  first, 2-week install instead of 5-month).

## 2. Pilot setup (200 words)

- Scope: which sections / years / courses.
- Timeline: kick-off → onboarding → go-live → mid-pilot review →
  semester end.
- Integrations: SIS import path, single sign-on (if any), FCM /
  notifications setup.
- Cost to the faculty: zero — unpaid design partner.

## 3. What we measured (400 words + 1 chart)

A bar chart comparing the pilot semester against the prior semester
across:

| Metric | Prior semester | Pilot semester | Delta |
|---|---|---|---|
| Average attendance rate | [%] | [%] | [+/-] |
| Late-arrival rate | [%] | [%] | [+/-] |
| Proxy-attendance incidents detected | [N] | [N] | [+/-] |
| Time the doctor spends on roll-call | [min/lecture] | [min/lecture] | [+/-] |
| Student adoption (≥ 1 scan / week) | n/a | [%] | n/a |

Methodology sidebar: how each metric was computed, time window, any
limitations (e.g. comparison is informal where the prior semester
had no equivalent measurement).

## 4. Three things that surprised us (250 words)

- **The positive**: e.g. "Doctors started using the in-app Start
  Lecture button for 92 % of sessions — we expected 60 %."
- **The neutral**: e.g. "Students opened the app a median 2.1× per
  day, mostly to check the schedule, not to scan."
- **The hard lesson**: e.g. "We had to ship Wi-Fi BSSID fallback
  mid-pilot — GPS alone failed in two basement halls. We did this in
  10 days. Lesson: ship multi-channel proof from day one."

## 5. Testimonials (150 words)

- 1 student quote (year 2 / year 3 ideal — they have a control to
  compare against).
- 1 doctor quote (a doctor who was sceptical at the start is
  high-signal).
- Optional: 1 admin quote on the operational ease.

## 6. What's next for [Faculty Name] (150 words)

- Their post-pilot decision (renew → paid contract, expand to N
  faculties, etc.).
- Features they've requested for the next cycle.

## 7. Call-to-action footer

- **For other faculties**: a 2-line plug — "Want to run your own
  pilot? [contact link]."
- **Pricing anchor**: a 1-line reference to our standard pricing band
  (don't promise their rate publicly).

---

## Appendices (not in the 4-page count)

- A. Architecture diagram (1 page).
- B. NAQAAE-mapping excerpt (1 page).
- C. Methodology note (1 page).
- D. Raw success-metric data (CSV link, gated).

## Approval workflow

1. Vendor PM drafts within 10 business days of semester end.
2. Design Partner dean + IT lead review within 15 business days
   (per pilot agreement §5).
3. Final published version is committed to `docs/case-study-final.md`
   and announced on the Vendor's website + LinkedIn.
