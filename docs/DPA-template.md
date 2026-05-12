# Data Processing Agreement (DPA) — Template

> Template aligned to **Egyptian PDPL Law No. 151/2020** ("Personal Data
> Protection Law") for use between the Saxony Smart Campus operator
> ("Processor") and a customer university ("Controller").
>
> This is a template, **not legal advice**. Have local counsel review
> before signature.

---

## 1. Parties

- **Controller**: _________________________________________________________ ("the University").
- **Processor**: _________________________________________________________ ("the Operator").
- **Effective date**: _____________________________________________________.

## 2. Definitions

The terms **Personal Data**, **Processing**, **Data Subject**, **Data
Controller**, **Data Processor**, and **Data Breach** carry the
meanings given to them in Egyptian PDPL Law 151/2020.

## 3. Subject matter & duration

The Operator processes Personal Data on behalf of the University
exclusively for the purpose of operating the Saxony Smart Campus
attendance & engagement platform. This DPA remains in force for the
duration of the underlying Service Agreement plus any retention period
mandated by PDPL.

## 4. Categories of Personal Data

| Category | Examples | Source |
|---|---|---|
| Identification data | National ID, university email, full name | University SIS export |
| Contact data | Mobile phone (optional), email | University SIS export |
| Authentication data | Hashed password, FCM device tokens, TOTP secret (admins) | App sign-up flow |
| Academic data | Section enrolment, attendance records, late/absent flags | App usage |
| Device / connection data | Device fingerprint, IP, Wi-Fi BSSID, GPS lat/lng at scan time | App usage |

**Special-category data:** none. No health, religion, political, or
biometric data are collected.

**Children's data:** the system supports university-age students; data
of minors (< 18) is not collected by default.

## 5. Categories of Data Subjects

- Students enrolled at the University.
- Faculty / lecturers ("doctors").
- Administrative staff with platform access.

## 6. Processing instructions

The Operator processes Personal Data only on documented instructions
from the University, including transfers to a third country, except
where required by Egyptian law (in which case the Operator informs the
University before processing unless that law prohibits notice).

## 7. Sub-processors

The Operator uses the following sub-processors. The University consents
generally; the Operator gives **30 days notice** before adding /
replacing any. The University may object on reasonable grounds.

| Sub-processor | Service | Location |
|---|---|---|
| (Cloud host — e.g. STC Cloud Egypt / Etisalat IDC) | Compute, network, storage | Egypt |
| Google LLC | Firebase Cloud Messaging (push only) | EU + US |
| (S3 / MinIO host) | Object storage (CSV exports, attachments) | Egypt |

## 8. Confidentiality

The Operator ensures personnel authorised to process Personal Data are
bound by confidentiality, either contractually or by statutory duty.

## 9. Security of processing

The Operator implements appropriate technical and organisational
measures, including:

- **Transport security:** TLS 1.2+ for all client / server traffic.
- **Authentication:** RS256 JWT with rotating refresh tokens, bcrypt-hashed.
- **2FA:** TOTP enforced for `super_admin` and `admin` roles.
- **Tenant isolation:** every tenant row is keyed by `universityId`;
  cross-tenant access is enforced at the service layer.
- **Auditability:** an `AuditLog` table records administrative actions.
- **Backups:** daily logical backups of Postgres retained for 30 days.
- **Vulnerability management:** monthly dependency upgrades, quarterly
  pen-test (operator responsibility).

## 10. Data Subject rights

The Operator assists the University in responding to Data Subject
requests (access, rectification, deletion, restriction, portability)
within the statutory PDPL window (15 days from receipt).

The University may export a Data Subject's record at any time via the
admin UI (Students → details → Export).

## 11. Personal Data Breach notification

The Operator notifies the University **without undue delay and at the
latest within 72 hours** of becoming aware of a Personal Data Breach,
including:

- nature of the breach;
- categories and approximate number of Data Subjects;
- likely consequences;
- measures taken or proposed.

## 12. Data transfers outside Egypt

Production data is hosted in Egypt by default. Cross-border transfers
(e.g. via Firebase Cloud Messaging) are limited to push-notification
tokens and message payloads; they do not include identification or
academic records. Standard contractual clauses are in place with all
sub-processors that operate outside Egypt.

## 13. Audit rights

The Operator makes available all information necessary to demonstrate
compliance with this DPA and allows for and contributes to audits,
including inspections, conducted by the University or an auditor
mandated by the University, with reasonable prior notice and no more
than once per calendar year (except after a Breach).

## 14. Return or deletion of Personal Data

On termination of the Service Agreement, the Operator, at the
University's choice, returns all Personal Data to the University in
machine-readable format (CSV / JSON) **or** deletes it within 60 days
and certifies deletion in writing. Backups containing the data are
purged on the standard rotation (max 30 days).

## 15. Retention

Operational Personal Data is retained for **the duration of the
student's enrolment plus 5 academic years**, after which it is
anonymised. Audit logs are retained for **3 years**.

## 16. Governing law & venue

This DPA is governed by Egyptian law. Disputes are subject to the
exclusive jurisdiction of the courts of Cairo.

## 17. Order of precedence

In case of conflict between this DPA, the Service Agreement, and any
purchase order, this DPA prevails on Personal Data matters.

---

## Signatures

| Party | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Controller** (University) | | | | |
| **Processor** (Operator) | | | | |
