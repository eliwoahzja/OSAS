# Contributing to SAAC - OSAS Dashboard

Welcome to the **Office of Student Affairs and Services (OSAS)** safety and compliance dashboard.
We welcome contributions that improve campus safety, compliance monitoring, and incident reporting.

---

## Development Philosophy & Pace

1. **Incremental Changes**: Please avoid monolithic "code dump" pull requests. Break large features into small, testable increments (e.g. schema migration → backend API route / mock adapter → UI components).
2. **Document Edge Cases**: Real campus systems face dirty data, offline connectivity during field drills, and mobile latency. Include clear `TODO`, `FIXME`, and contextual developer comments documenting assumptions and deferred tasks.
3. **Domain Compliance**:
   - Comply with the Philippine **Data Privacy Act of 2012 (RA 10173)** regarding student identities and disciplinary records.
   - Align drill scheduling and evaluation metrics with **DepEd Order No. 48, s. 2012** (Quarterly NSED standard benchmark).
   - Follow **Bureau of Fire Protection (BFP)** inspection intervals for fire extinguishers (6-month checks).

---

## Git Workflow & Commit Guidelines

### Branch Naming
- `feat/<feature-name>` (e.g., `feat/sms-gateway-batching`, `feat/deped-report-export`)
- `fix/<issue-name>` (e.g., `fix/phone-prefix-sanitization`, `fix/table-overflow-mobile`)
- `chore/<task-name>` (e.g., `chore/bump-tailwind`, `chore/seed-data-update`)

### Commit Messages & Trailers
Use conventional commit style with optional trailers to track collaboration and reviews:

```text
feat(drills): add evacuation timing countdown and marshal checklist

- Add real-time benchmark timer for 4-minute campus evacuation standard
- Record designated assembly point marshal sign-offs

Co-authored-by: Campus Safety Officer <safety-lead@saac.ph>
Signed-off-by: eliwoahzja <shinazutempest@gmail.com>
Reviewed-by: Lead Administrator <admin@saac.ph>
```

---

## Verification Before Submitting

Run syntax and module check before committing:

```bash
npm test # or node scripts/lint.mjs
```
