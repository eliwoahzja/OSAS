# OSAS Capstone Readiness Audit

**Assessment date:** 2026-11-03 (Asia/Manila)  
**Repository:** [eliwoahzja/OSAS](https://github.com/eliwoahzja/OSAS/tree/main)  
**Reference implementation audited:** `c4a667050c3a8f5515338b7c967604c06f8d2b23` on `main`  
**Scope:** Repository review, GitHub CI status, applied Supabase performance migration and post-change advisor checks, Vercel production deployment verification, and owner-reported change to hosted sign-up settings.

## Status meanings

- **Verified**: inspected against source, completed CI, or connected live backend.
- **Tested**: repository verification report or passing browser/unit tests support the item. A simulated browser request is not real external delivery.
- **Owner confirmed; recheck pending**: owner states a hosted control has been updated, but an independent read of the new value was unavailable.
- **Open**: requires an implementation change, decision, or test.

## Completed or supported by tests

| Area | Status | Evidence and boundary |
| --- | --- | --- |
| GitHub CI for the audited commit | Verified | [Workflow run 41655743252](https://github.com/eliwoahzja/OSAS/actions/runs/41655743252) succeeded; the [verification report](verification-2026-11-03.md) records 152 passing tests. |
| Admin PIN and student email OTP flows | Tested | Authentication and browser test suites cover setup, retry, recovery, and session handling. App-level PIN/OTP is **not** database-level MFA AAL2. |
| Incidents and up to eight required images | Tested + live policies verified | Browser tests cover upload, retry and gallery. Live database has private `incident-evidence` bucket and student ownership RLS. |
| Student incident privacy | Verified | Live `incidents` SELECT policy restricts to submitter or administrator. |
| Workspace roles and account read boundaries | Verified | Live RLS exists on application tables and newest restrictive read policies are applied. |
| Student announcements and grade assignments | Tested + live policies verified | Browser tests and deployed policies restrict management and grade assignment to administrators. |
| Workspace mobile/desktop routing | Tested | Verification report documents 1440px and 390px coverage, plus native touch checks. |
| Supabase Edge Functions | Verified active | Nine functions reported ACTIVE in the connected project. Active deployment is not proof of successful end-to-end execution. |
| README role matrix | Fixed in source | Documentation now matches `js/app.js` route permissions: four student-accessible routes; remaining management routes administrator-only. |
| Public sign-up disabled | **Owner confirmed; recheck pending** | Owner reports turning OFF **Allow new users to sign up** in Supabase Authentication settings. The previous report captured `disable_signup: false` before the reported change. Independently re-read the hosted setting and test regular sign-up rejection and admin-managed creation before closing. |
| Foreign-key and RLS performance | **Verified in live Supabase** | Migration `20261103155508_optimize_fk_indexes_and_rls_policy_plans.sql` added 7 indexes, converted 6 per-row Auth policies to cached init plans, and consolidated redundant account-read policies. Performance advisor now reports no missing FK indexes, Auth initplan warnings, or multiple permissive policies. New indexes are currently unused; database tables are small. |
| Vercel production output | **Verified deployed** | `vercel.json` now targets generated `dist/`. `frontend` and `codebase` production deployments for `156b747e` report READY; `https://stagnesacademy.vercel.app/` and its JS entry point returned HTTP 200. A probe of `/server.js` returned HTML fallback, not server source. |
| Production packaging CI check | **Verified** | [Workflow run 41669037508](https://github.com/eliwoahzja/OSAS/actions/runs/41669037508) passed, including checks for required dist files and exclusion of `server.js` and `supabase/`. |

## Outstanding tasks (priority order)

### P0: Security and privileged operations

- [ ] **Verify registration policy after owner change.** Refresh Supabase Authentication hosted setting; attempt ordinary sign-up with a disposable test mailbox (should be rejected); verify admin `manage-accounts` creation still succeeds. Do not mark verified solely from the toggle screenshot or owner message.
- [ ] **Enforce MFA for sensitive administrator access.** PIN validation occurs in the application, but administrator JWT roles directly authorize database actions. Introduce approved Supabase MFA plus assurance-level checks or equivalent server-enforced step-up for sensitive operations. Regression-test direct API access before and after the second factor. See [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).
- [ ] **Bind assistant approval to the human administrator.** `supabase/functions/agent-tools/core.ts` checks `confirm: true` for destructive actions and notifications, but a model-selected argument is not proof of a human decision. Implement a server-verified, action-specific approval record or challenge; audit target, actor, expiration and replay resistance.
- [ ] **Enable leaked-password protection and review MFA methods.** The connected Supabase security advisor flagged both settings. See [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### P1: Defense credibility and delivery reliability

- [ ] **Run real end-to-end acceptance tests** for guardian/clinic email delivery, error handling, live n8n read/write confirmation, and physical printing. Use authorized test recipients and record evidence. Existing browser checks intercepted some outbound requests.
- [ ] **Validate risk-scoring method** with school safety stakeholders. `js/modules/risk.js` uses five multiplicative factors minus a 1–5 control score, so changing controls from 1 to 5 reduces any score by only four points. Justify weighting, level bands and sensitivity, and reconcile the displayed 'Low 1–250' label with a minimum score of zero. Document model limitations.
- [ ] **Review public file access and retention.** Live `incident-evidence` is private. `evacuation-maps` and `inspection-photos` are public-read. Classify stored content and make sensitive evidence private with short-lived links; document access and deletion requirements.
- [ ] **Document emergency outage procedures.** Explain how reports, evacuation plans, and notifications are handled without internet or a working Supabase service. Test recovery and reconciliation without exposing personal data.
- [ ] **Make role terminology consistent** across the README, user-facing screens, capstone documentation and actual permission tests. The README table was corrected in this update; review remaining text and diagrams.
- [ ] **Review risky legacy SQL scripts.** `supabase/open_access.sql` creates permissive policies. It is not evidence the current database is exposed, but it should be clearly archived or labeled never to run on production. Fresh-setup and migration instructions must be reproducible and safe.

### P2: Operations and performance

- [ ] **Set intended default branch and protect it.** GitHub still reports `master` as default and `main` as unprotected. The connected GitHub actions expose source and CI writes but no repository-settings mutation. Repository administrator action is required in [GitHub Settings](https://github.com/eliwoahzja/OSAS/settings): set default branch to `main`, then create a branch ruleset for `main` requiring the `verify` CI check and blocking force pushes/deletions. Recheck settings afterward.
- [x] **Align build output with Vercel configuration.** `vercel.json` now uses `outputDirectory: "dist"`; the source `.vercelignore` still excludes stale local build artifacts, but Vercel generates `dist/` during its remote build. Production deployed from `main`, the static entry points respond, and the CI artifact smoke checks passed.
- [x] **Address missing FK indexes and RLS initialization warnings.** Applied `20261103155508_optimize_fk_indexes_and_rls_policy_plans` to the linked database and committed the exact SQL migration. Post-change performance advisor has no missing FK index, Auth RLS initplan, or multiple permissive policy finding. Future query benchmarking is still advisable, because the small tables do not yet show measurable performance gains. The advisor reports unused-index informational entries; do not drop newly created indexes merely because no workload has used them yet.
- [ ] **Remove repository-specific personal fallback contact values** from client configuration where unnecessary; rely on documented environment/site settings.
- [ ] **Expand CI** to exercise database migrations, live-equivalent RLS tests, and representative authenticated API workflows, in addition to existing JavaScript checks. [x] Production static artifact checks were added and passed.

## Defense questions to prepare

1. Which real OSAS workflow failed before this system, and what evidence demonstrates improvement?
2. What precise permissions do students and administrators possess? Demonstrate using database-level tests, not hidden menu items.
3. Why does the app PIN not constitute database-enforced MFA?
4. How do incident attachments remain private, and what happens if an upload or report insert fails?
5. Who validated the risk-scoring formula and classification bands?
6. What evidence proves a guardian message was delivered rather than merely accepted by an API?
7. How does the AI gateway prove **human approval** before sensitive actions?
8. What happens when the school loses internet access during an emergency?
9. Are the live deployment, migration history, and submitted source revision reproducible?

## Provenance / limitations

- [November 3 verification report](verification-2026-11-03.md) describes its own simulation boundaries. It captured the hosted sign-up setting **before** the owner-reported change; it is intentionally preserved as historical evidence rather than edited to imply a re-test.
- Supabase advisor findings were read from the connected project on November 3. Some warnings about RLS-enabled tables with no policies are consistent with intentionally private service-role-only tables; audit those per table instead of declaring all of them vulnerable.
- This document is an assessment and work queue. It does **not** assert the open items have been fixed or that real external delivery was tested.
