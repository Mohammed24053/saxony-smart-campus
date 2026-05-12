# Operational scripts

## `sis-import.ts`

CSV → `User` + `Student` row importer for the pilot faculty's SIS export.

**CSV columns** (header row required):

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Lower-cased, unique. |
| `studentId` | yes | University-side ID, unique. |
| `name` | yes | Full name. |
| `sectionName` | yes | Auto-created if missing. |
| `faculty` | no | Free text (e.g. "Computer Science"). |
| `year` | no | Integer 1–6. |
| `phone` | no | E.164 with leading `+`. |
| `password` | no | Defaults to `<studentId>!2025`. |

**Run:**

```bash
# Dry-run — prints counts, writes nothing.
pnpm --filter backend exec ts-node ../scripts/sis-import.ts \
  --file ../scripts/sis-import.example.csv --dry-run

# Real import (uses the seeded university by default).
pnpm --filter backend exec ts-node ../scripts/sis-import.ts \
  --file /path/to/students.csv
```

**Idempotent:** re-running the same CSV updates existing rows (name,
phone, section, faculty, year) but never overwrites a password that's
already in use. New rows are created with a default password the
student is expected to reset on first login.

**Generate-keys script:** `scripts/generate-keys.sh` writes the RS256
JWT keypair into `backend/.env`. Re-run any time you need to rotate.
