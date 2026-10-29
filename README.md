# OSAS Campus Safety & Disaster Risk Reduction Dashboard

**Office of Student Affairs & Services (OSAS) — Saint Agnes Academy (SAAC)**

A web dashboard for logging campus incidents, scheduling drills, tracking safety inspections and first-aid stock, scoring hazards, and emailing parents and clinic staff. It follows the intent of DepEd Order No. 48, s. 2012 (quarterly simultaneous earthquake drill) and NDRRMC guidance, and handles student data with the Data Privacy Act of 2012 (RA 10173) in mind.

---

## What it does

| Module | What is implemented |
|---|---|
| **Incident logging** | Type, severity (`low` / `medium` / `high`), location, reporter (**auto-filled from the signed-in account**, read-only), optional student. Optional urgent email to that student's parent/guardian. Students see this module as *Report Incident*. |
| **Drill scheduling** | Fire, earthquake, lockdown and evacuation drills. Optional event notice emailed to an audience (all parents, or a grade). |
| **Evacuation plans** | Floor-plan upload to Supabase Storage with exits, routes, assembly point and version. |
| **Safety inspections** | Checklist per area. An item whose last check is older than its frequency is shown as **overdue** automatically. |
| **First-aid supplies** | Items at or below the reorder threshold are flagged low. *Notify Stock Handlers* emails the **school nurse / clinic contacts** registered in Emergency Contacts (never police/fire/other agencies). |
| **Risk assessment** (admin) | Six 1–5 factors: `Score = (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls`, floored at 0. Bands: Low 1–250, Moderate 251–500, High 501–750, Critical 751+. An admin must write the root-cause rationale before saving. |
| **Parent notifications** | *Urgent incident alert* (that student's guardian only, or an admin-only campus-wide alert that does **not** name the student) and *event notice*. |
| **Safety reports** (admin) | Compliance metrics, **CSV export** (incidents, inspections, drills, supplies) and print / save as PDF. |
| **Accounts** (admin) | Create / list / delete Administrator and Student accounts. |
| **Emergency roles / contacts** | Directory of guardians (per student) and school responders. |

The dashboard refreshes on incident Realtime events, local writes and window focus, with a 15-second polling fallback.

## Architecture

* **Frontend:** vanilla JavaScript ES modules, precompiled Tailwind CSS v3, a small DOM builder (`js/ui.js`), custom SVG charts (`js/charts.js`). Hash router in `js/app.js`.
* **Backend:** Supabase — PostgreSQL with Row Level Security, Supabase Auth, Storage, and one Edge Function (`send-notification`) that sends email through Maileroo.
* **Server:** `server.js` is only a static file server (Express).
* **Two data modes, never mixed:**
  * **Signed in** → live Supabase data only. A failed save shows the real error; nothing is silently stored in the browser.
  * **Demo mode** (explicit button on the login screen, or when Supabase is not configured) → sample data in `localStorage`, clearly labelled, no database writes, no emails.

```
index.html            SPA shell
js/app.js             router, login screen, dashboard
js/api.js             REST client, data-mode switch, notification client
js/auth.js            Supabase sign-in / sign-out, roles
js/modules/*          one file per feature area
supabase/schema.sql   fresh-database schema (DROPS TABLES — new projects only)
supabase/live_fixes.sql   safe, re-runnable fixes for an existing database
supabase/functions/send-notification/   email Edge Function
```

## Setup

1. **Database.** New project: run `supabase/schema.sql` once, then `supabase/seed.sql` if you want sample rows. Existing project: run **`supabase/live_fixes.sql`** only (it never drops data). Never re-run `schema.sql` on live data.
2. **Users and roles.** Create users in *Authentication → Users*. Roles are read from `app_metadata` (writable only with the service role), so an admin is created like this:
   ```sql
   UPDATE auth.users
   SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'
   WHERE email = 'admin@yourschool.edu.ph';
   ```
   Anyone without that role is `staff`.
3. **Email function.**
   ```bash
   supabase functions deploy send-notification
   supabase secrets set MAILEROO_API_KEY=... MAILEROO_FROM="Saint Agnes Academy OSAS <osas@your-verified-domain>"
   ```
4. **Config.** Put your project URL and anon key in `js/config.js` (the anon key is public by design; RLS is what protects the data).
5. **Run.** `npm install && npm run dev`, then open http://localhost:3000. `npm run lint` syntax-checks every module.

## Login, OTP and accounts

Sign-in is two steps: **email + password**, then a **one-time code emailed to the user**. The session only exists after the code is verified.

**Two account types**

| | Administrator | Student |
|---|---|---|
| Dashboard, Emergency Contacts, Drill Scheduling, Evacuation Plans, Incident Logging, Safety Inspections, Parent Notifications, First Aid Supplies | yes | yes |
| Risk Assessment, Safety Reports, Emergency Roles, **Accounts** (create/delete users) | yes | no |

Admin tabs sit under their own *Administrator* heading in the sidebar and are not shown (or reachable) for students. The stored role value stays `client` (Supabase `app_metadata.role` and `users.role`); the UI maps it to the label **Student** through `js/labels.js`. In the Student workspace the incident page is worded *Report Incident* / *Save Report*, and the two supply charts on the dashboard are administrators-only.

**One-time setup**

1. Run `supabase/lock_down.sql` in the SQL editor (removes the old no-login access), then make your first admin with the `UPDATE auth.users …` snippet at the bottom of that file.
2. Supabase → *Authentication → Email Templates → **Magic Link***: the OTP email uses this template. Make sure it shows the code, e.g. `Your SAAC OSAS verification code is {{ .Token }}`.
3. Supabase → *Authentication → Providers → Email*: keep **Enable sign ups** off (accounts are created by admins) and set the **hosted project's** OTP length to 6 if six-digit codes are required. The frontend also accepts complete 6–10-digit email OTPs so an eight-digit code from an existing hosted setting is not silently truncated. **`supabase/config.toml` configures local development, not a hosted Supabase project automatically.**
4. Supabase's built-in mailer is limited to a few emails per hour. For real use, set **custom SMTP** (*Authentication → SMTP Settings*), e.g. your Maileroo SMTP credentials.
5. Deploy the account function: `supabase functions deploy manage-accounts` (uses the project's service-role key server-side; only a signed-in admin can call it).

**Known limit:** the OTP step is enforced by the app. A person who already knows a password could still call Supabase's API directly and skip the code. Fully enforcing 2-step on the server needs Supabase MFA (AAL2) or a custom auth hook.

## Security and privacy

What is enforced:

* Sign-in is required. Row Level Security allows reads/writes only for signed-in users; risks, roles, reports, supplies and evacuation plans are admin-write only; deletes are admin-only.
* The Edge Function rejects anyone without a valid user session (the public anon key alone is not accepted), whitelists the columns it writes, and only admins may send a campus-wide alert.
* Each parent receives their own email (recipients never see each other's addresses). Emails go out in small batches with a short pause to avoid provider rate limits.
* A single student's incident alert is **never** widened to all parents; if no guardian email exists the send fails with a clear message.
* Every insert/update/delete on operational tables is recorded in `audit_log` by database triggers.

Known limitations (be upfront about these):

* Guardian phone numbers and emails are readable by every signed-in staff account; there is no field-level masking or encryption yet.
* Any signed-in account can read every module; there is no per-building or per-grade scoping.
* Storage buckets are public-read so floor plans and inspection photos can be displayed by URL.
* Risk-score inputs are subjective 1–5 ratings; the formula is a prioritisation aid, not a measurement. Security controls are subtracted from the product, so they matter less as the product grows.

## License

Internal software developed for Saint Agnes Academy (SAAC). Released under the MIT License for educational and disaster-risk-reduction demonstration purposes.

## Emergency workspace behavior

Emergency Contacts lists school personnel and emergency agencies only (`category = school`). Its columns are contact person, emergency type, contact number and status, with administrator controls. Students receive a read-only directory. Existing guardian records and incident notification links stay in the database. Administrators should enter verified local service numbers.

First Aid Supplies shows item descriptions / pack sizes, category, quantity, storage location, expiry, reorder threshold and status. The overflow actions open editing, deletion and saved stock history. Status priority is Expired, Expiring Soon, Low Stock, then In Stock. An item is expired after its expiry date, low at or below the reorder threshold, and expiring soon within 30 days including today. Calendar dates use Asia/Manila. Categories and active contact flags use the existing stakeholder migration in `supabase/migrations/`.

Safety Inspections includes frequency, last inspection, next due date, risk, inspector and record actions. Filters cover status, area, frequency and a due-date range. The sidebar opens upcoming inspection details, a month calendar, CSV export and a printable report for saving as PDF. Checkboxes select inspections across pages. Exports use the selection when present, or the current search and filters. Recent Activity reads saved insert, update and delete events from the audit log. Due Soon means a check falls within the next seven days, including today. Failed checks retain their failed status. Frequency intervals preserve the existing day-based schedule. Editing a computed status retains the stored inspection result until the administrator changes it.

Emergency Roles links staff responsibilities to existing building and floor evacuation plans, filters assignments by floor plan, opens the linked map, and rejects duplicate responsibilities for the same floor and zone. Internal identifiers stay available for database relations but do not appear in table columns or detail fields.

Run `npm test` for status and date-boundary regression tests, and `npm run build` for JavaScript syntax checks and static output.

The `complete_stakeholder_inventory_details` migration adds the optional supply description and restricts audit snapshots to administrators. It also protects the existing audit trigger function from direct client calls. For a fresh database, apply the files in `supabase/migrations/` in order after `schema.sql`; for an existing database, apply only missing migrations.

The inspection reference layout shows all columns at 1440px and 1536px, uses a compact date-range control and numbered pages, and groups the schedule and activity panels beside the checklist at 1536px. Mobile action columns stay visible during horizontal table scrolling. Low Stock badges use amber above half the reorder threshold and red at or below half; expiry conditions keep their existing priority.

### Stakeholder reference inventory

The demo and fresh-database seed include all ten supplied First Aid Supplies rows, including In Stock items. On an existing database with the inventory migrations applied, run `supabase/reference_supplies.sql` to add missing reference items and fill blank categories/pack descriptions. It preserves existing quantities, dates and restock history and can be re-run without duplicating items. The CPR mask quantity is blurry in the reference; the sample uses 5 pcs. Stock badges remain calculated from the actual quantity and expiry date, so they can differ from the illustrative screenshot.

### Admin-approved password recovery

Sign-in → **Forgot password?** submits an approval request. Administrators receive an email containing the saved account name, email, role, creation date, last sign-in, and request time. **Accounts → Requests → Review request** provides approval, rejection, and link revocation. Approval sends a single-use link to the saved account email. The owner chooses a new password, then signs in normally. Approval itself leaves the old password unchanged.

Apply `supabase/migrations/20261028134104_admin_password_reset_requests.sql` and deploy `supabase/functions/password-reset` with JWT gateway verification disabled. Public request and token-completion routes use their own controls; list/approve/reject validate the session and `app_metadata.role` on the server. The tables and submit RPC are accessible only to the service role. Links contain 32 random bytes, expire after 30 minutes, and are stored only as SHA-256 hashes. Public responses do not reveal whether an email exists. Requests are limited to five per source IP per hour and one per account per hour, with pending requests deduplicated.

The function reuses existing `MAILEROO_API_KEY` / `MAILEROO_FROM` or `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` secrets. `PUBLIC_APP_URL` in `supabase/functions/password-reset/core.ts` controls the production email destination (`https://osas.stagnesacademy-sms.com/`). Failed emails keep requests visible in Accounts for review/retry. Automated tests use fake delivery and do not email users or change live passwords.

The custom domain is `https://osas.stagnesacademy-sms.com/`, with Accounts at `/#/accounts`. The host deploys a selected Git commit independently of Vercel. Serve `index.html`, `js/`, `css/`, and `assets/` at the subdomain's document root, or use `npm run build` and serve `dist/`. The frontend is static; Supabase continues to host Auth, data, and Edge Functions. Hash routes need no server rewrite. HTTPS is required for authentication and PIN encryption. New account-request emails already use this domain for review links, password setup links, and the logo. Existing emailed links retain their original destination.

The applied `defer_managed_account_guard` migration checks managed account roles at transaction commit because Supabase Auth applies Admin API `app_metadata` after inserting the user. Admin-created student/admin accounts pass; accounts without a trusted role still fail, including attempts to spoof a role through `user_metadata`.

### Latest stakeholder changes

Signed-out visitors now start on a public safety brochure with earthquake, fire, typhoon, and flood guides; school drill preparation; and a local readiness checklist. Each guide links to its government source. The brochure uses static content and does not load school records. Sign-in opens from the header, with a return button to the brochure. Direct school workspace routes remain behind sign-in, password approval links still open their password form, and sign-out returns to the brochure. Deploy the selected commit as usual; the build includes `css/landing.css`, `js/landing.js`, and `assets/earthquake-cover.svg`.

`tropanggala87@gmail.com` uses its existing account and password with Administrator access and email-code sign-in. The active school nurse contact already uses that address for stock alerts. Other admin accounts remain available. Public registration has been removed from the UI and auth module; administrators create student accounts through Accounts. Local Supabase config disables signup. The applied `20261028220637_managed_account_creation_guard.sql` blocks unprovisioned account inserts on the hosted project. Admin-created accounts include trusted app metadata and pass the guard.

Parent Notifications is admin-only in navigation, its module, the send function, and the hosted read policy (`20261028212100_admin_notification_privacy.sql`). Emergency Roles keeps its existing assignments and maps with the shorter heading. Risk Assessment includes an editable ten-point earthquake prevention example, requires prevention measures on new assessments, and links to PHIVOLCS guidance. Existing risks are retained.

The incident charts use every page of live incident rows, refresh on Realtime events, local writes and focus, and retain 15-second polling. Student dashboards do not fetch admin-only inspection/drill/stock tables. The yearly chart supports zero or one year of records. Demo data remains separate from live API data.

### Approval requests for registration and recovery

Both sign-in request forms collect a full name and email before submitting. The registration link opens a request form, rather than an email client. Every administrator with an email address receives the request. The Accounts queue shows the submitted name separately from the saved account name and distinguishes registration from password recovery.

`20261028215619_approved_account_requests.sql` adds registration requests to the protected queue. An approved registration link creates a Student account only when its owner submits a new password. Existing accounts are never reused or reset by a registration request. Password-reset requests retain their existing account and role. Approval links remain hashed, expire after 30 minutes, support revocation and work once. Server-side validation requires a full name; generic responses and shared rate limits prevent account enumeration and duplicate mail requests.

### Incident review and student dashboard spacing

Administrators review incidents through a status action next to each row; the admin header no longer offers Log Incident. Students retain Report Incident and see status updates through Realtime, focus refresh and 15-second polling. The applied `20261028220551_incident_admin_status_controls.sql` allows status updates only for admins and requires student submissions to start Open. Student summary cards use two full-width columns, the two incident charts share the analytics grid, and the footer follows the content without a large gap.

### Request cleanup and email appearance

Accounts uses one **Requests** section for registration and recovery. Admins can delete reviewed requests from the visible list after approval, rejection or completion. This archives the queue row and preserves active password links, review history and duplicate-request limits; pending requests cannot be removed before review. The applied `20261028221153_request_queue_cleanup.sql` adds the archive timestamp. Request and password-setup emails now share the existing sign-in template's cream background, gradient maroon header, school logo, rounded white card and typography.
