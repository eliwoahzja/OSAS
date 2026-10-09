# OSAS Campus Safety & Disaster Risk Reduction Dashboard

**Office of Student Affairs & Services (OSAS) — Saint Agnes Academy (SAAC)**

A web dashboard for logging campus incidents, scheduling drills, tracking safety inspections and first-aid stock, scoring hazards, and emailing parents and clinic staff. It follows the intent of DepEd Order No. 48, s. 2012 (quarterly simultaneous earthquake drill) and NDRRMC guidance, and handles student data with the Data Privacy Act of 2012 (RA 10173) in mind.

---

## What it does

| Module | What is implemented |
|---|---|
| **Incident logging** | Type, severity (`low` / `medium` / `high`), location, reporter, optional student. Optional urgent email to that student's parent/guardian. |
| **Drill scheduling** | Fire, earthquake, lockdown and evacuation drills. Optional event notice emailed to an audience (all parents, or a grade). |
| **Evacuation plans** | Floor-plan upload to Supabase Storage with exits, routes, assembly point and version. |
| **Safety inspections** | Checklist per area. An item whose last check is older than its frequency is shown as **overdue** automatically. |
| **First-aid supplies** | Items at or below the reorder threshold are flagged low. *Notify Stock Handlers* emails the **school nurse / clinic contacts** registered in Emergency Contacts (never police/fire/other agencies). |
| **Risk assessment** (admin) | Six 1–5 factors: `Score = (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls`, floored at 0. Bands: Low 1–250, Moderate 251–500, High 501–750, Critical 751+. An admin must write the root-cause rationale before saving. |
| **Parent notifications** | *Urgent incident alert* (that student's guardian only, or an admin-only campus-wide alert that does **not** name the student) and *event notice*. |
| **Safety reports** (admin) | Compliance metrics, **CSV export** (incidents, inspections, drills, supplies) and print / save as PDF. |
| **Accounts** (admin) | Create / list / delete Administrator and Client accounts. |
| **Emergency roles / contacts** | Directory of guardians (per student) and school responders. |

The dashboard refreshes itself every 15 seconds (polling, not websockets).

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

| | Administrator | Client |
|---|---|---|
| Dashboard, Emergency Contacts, Drill Scheduling, Evacuation Plans, Incident Logging, Safety Inspections, Parent Notifications, First Aid Supplies | yes | yes |
| Risk Assessment, Safety Reports, Emergency Roles, **Accounts** (create/delete users) | yes | no |

Admin tabs sit under their own *Administrator* heading in the sidebar and are not shown (or reachable) for clients.

**One-time setup**

1. Run `supabase/lock_down.sql` in the SQL editor (removes the old no-login access), then make your first admin with the `UPDATE auth.users …` snippet at the bottom of that file.
2. Supabase → *Authentication → Email Templates → **Magic Link***: the OTP email uses this template. Make sure it shows the code, e.g. `Your SAAC OSAS verification code is {{ .Token }}`.
3. Supabase → *Authentication → Providers → Email*: keep **Enable sign ups** off (accounts are created by admins).
   The app accepts **5-digit** codes (and longer if Supabase issues them).
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
