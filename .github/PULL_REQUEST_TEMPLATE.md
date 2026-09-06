## Proposed Changes

- Brief description of the feature, fix, or operational update:

## Type of Change

- [ ] New safety module / feature
- [ ] Bug fix (non-breaking change fixing a safety workflow issue)
- [ ] Regulatory compliance update (DepEd / NDRRMC / BFP)
- [ ] UI / UX refinement or responsive layout fix
- [ ] Documentation or database migration script

## Compliance & School Safety Checklist

- [ ] **Data Privacy (RA 10173)**: Verified that minor student information and disciplinary records are not leaked in public/unauthorized views.
- [ ] **DRRM Standards**: Conforms to DepEd Order No. 48 s. 2012 / NDRRMC earthquake & fire drill benchmarks.
- [ ] **Notification Gateway**: Verified SMS / email notification payloads and rate limit safeguards.
- [ ] **Offline Fallback**: Tested with network disconnected — mock/local persistence gracefully handles unavailable remote database.
- [ ] **Mobile Touch Test**: Verified that table views and modal actions are operable on handheld devices (e.g., student marshal tablets).

## Self-Review & Notes

<!-- Leave any notes on trade-offs, known edge cases, or follow-up TODOs for peer reviewers -->

Signed-off-by: {{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>
