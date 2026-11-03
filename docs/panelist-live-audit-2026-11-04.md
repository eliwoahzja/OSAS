# OSAS: Panelist Source and Public Deployment Examination

**Date:** November 4, 2026  
**Revision reviewed:** Main branch during the November 4 cleanup.  
**Method:** Connected GitHub file and CI inspection, connected Supabase read-only inspection from the prior audit, and GET requests to the deployed public frontend. No authenticated accounts were accessed. No guardian notifications were sent.

## What was directly exercised

| Probe | Observed result | Assessment |
| --- | --- | --- |
| `GET /` | HTTP 200, OSAS public safety HTML | Public entry responds |
| `GET /js/agent.js` | HTTP 200, JavaScript module | Static asset responds |
| `GET /css/landing.css` | HTTP 200, stylesheet | Static asset responds |
| `GET /nonexistent-capstone-check.js` | HTTP 200, OSAS HTML document instead of 404 | **Defect:** unknown asset paths misreport success and return the wrong content type |
| `GET /supabase/schema.sql` | HTTP 200, OSAS HTML document, not SQL source | No SQL contents observed; misleading 200 fallback |
| `GET /.env.example` | HTTP 200, OSAS HTML document, not environment contents | No environment contents observed; misleading 200 fallback |

Requests to authenticated pages and database writes were not performed. The browser workflow report in `docs/verification-2026-11-03.md` intercepted Auth and Edge requests and does not replace genuine external delivery tests.

## Panelist findings, highest priority first

### 1. Administrator PIN does not prove backend step-up authentication

**Evidence:** `js/auth.js` implements PIN gating in the application while Supabase authorization relies on the authenticated admin JWT role. The README explicitly says this is not native MFA AAL2.

**Panel challenge:** Show what prevents a password-authenticated administrative session from calling privileged database endpoints without passing the visible PIN screen.

**Required improvement:** Stronger backend-enforced MFA or a verified step-up check on sensitive operations, with direct-API regression tests.

### 2. AI action confirmation is not independent human authorization

**Evidence:** `supabase/functions/agent-tools/core.ts` accepts a `confirm: true` data value for sensitive actions. An AI workflow supplies the tool payload.

**Panel challenge:** Prove an administrator, rather than the model or workflow, confirmed the specific recipient, record, and action.

**Required improvement:** Action-specific, server-bound human confirmation with expiration, replay resistance and audit records.

### 3. Incident reporting requires image evidence in every new student report

**Evidence:** The student form requires 1-8 photos; restrictive incident insert policies enforce a photo. The technical requirement is implemented.

**Panel challenge:** How does a student report a dangerous but unphotographed incident, or an emergency where taking a photo is unsafe or impossible? Does the application delay the initial warning?

**Required improvement:** Validate this business rule with real OSAS staff. Consider a documented urgent text-only pathway with later evidence submission, if approved by the stakeholder. Do not silently change the original required-image feature.

### 4. Risk severity classifications lack defensible calibration

**Evidence:** The five multiplicative factors yield a score up to 3125 before subtracting a 1-5 security-controls factor. The maximum difference between the weakest and strongest controls is four points. Thresholds 251, 501 and 751 are embedded in `js/modules/risk.js`.

**Panel challenge:** What data or cited methodology validates the formula, weighting, cutoffs and response priorities?

**Required improvement:** Expert validation, sensitivity analysis, realistic test scenarios and explicit limitations.

### 5. Unknown public URLs return HTTP 200 instead of 404

**Evidence:** A GET to an invented JavaScript asset returned the complete HTML page and HTTP 200.

**Panel challenge:** Why does a missing JavaScript asset report success and return HTML? What happens to monitoring, browser module loading and automated tests?

**Required improvement:** Correct Vercel fallback behavior for nonexistent assets, and add a deployed HTTP status/content-type smoke test.

### 6. Production notifications lack independent receipt evidence

**Evidence:** Previous verification intercepted real outbound requests. Active Edge Functions do not prove a guardian received email.

**Panel challenge:** How do you differentiate API acceptance, provider processing, delivery, bounce, and actual receipt?

**Required improvement:** Supervised test recipients, provider delivery records, retry behavior and logs that avoid exposing student information.

### 7. Privately stored incidents and publicly readable inspection imagery differ in protection

**Evidence:** The incident-evidence bucket is private while the inspection-photos and evacuation-maps buckets were public in the connected project.

**Panel challenge:** What data classification justifies public inspection photos and maps, and who approves retention and access?

**Required improvement:** Stakeholder-approved file classification, retention policy, and private evidence links as necessary.

### 8. Inconsistent repository governance and incomplete reproducibility

**Evidence:** GitHub reports `master` as default while CI and production use `main`; `main` was unprotected. The repository contains a historical baseline SQL schema and additive migrations.

**Panel challenge:** Which exact commit is under defense? Can an examiner recreate a clean database and confirm the same security policies without manual historical fixes?

**Required improvement:** Make `main` default, enforce branch protection, test fresh database setup and record the deployed commit.

### 9. Student chatbot is rule-based navigation, not the administrative AI agent

**Evidence:** `js/agent-commands.js` handles student questions with keyword patterns and local responses; the n8n AI workflow is admin-restricted.

**Panel challenge:** If you describe both interfaces as AI, explain accurately what is algorithmic navigation versus a remote language model.

**Required improvement:** Use accurate module descriptions and provide separate test evidence for student navigation and admin AI tasks.

## Defense verdict

The source demonstrates working modules and regression coverage. Production readiness remains **unproven** for backend MFA, human-controlled AI writes, real notification delivery, stakeholder validation of risk scoring, and emergency-offline operation. A claim of “fully secure” or “fully operational” is not supported by the currently available evidence.

The source cleanup is a maintenance task, not a solution to those functional issues. It leaves historical applied migrations and license terms in place for reproducibility and compliance.
