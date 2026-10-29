# Email + live-data wiring for the OSAS dashboard

This project now has two separate email paths. Both were failing/ambiguous and
have been fixed, but they still need real secrets/config in your Supabase project
to work live.

## 1) Sign-in codes and password reset emails (Supabase Auth)

`js/auth.js` sends the one-time code through Supabase Auth (`signInWithOtp` /
`verifyOtp`). For that to actually arrive, Supabase Auth must be able to send
emails. If it is not configured, the login screen now says what is wrong instead
of a generic "Could not send the code."

Required setup in your Supabase project:

1. Supabase → Authentication → Email
   - Set real SMTP credentials **or** a working custom email provider.
   - Without this, OTP/magic-link emails will not be sent.
2. Supabase → Authentication → Email Templates
   - Magic Link template: use `supabase/templates/magic_link.html`
   - Confirmation template: use `supabase/templates/confirmation.html`
   - Reset Password template: use `supabase/templates/recovery.html`. Keep
     `{{ .ConfirmationURL }}` as the reset button's destination.
   - The Magic Link and Confirmation templates include `{{ .Token }}`,
     which is the OTP code the app expects.
3. Supabase → Authentication → Sign In / Providers → Email
   - Enable the **Email provider**. Disabling the provider blocks both email
     and student-ID password logins with `email_provider_disabled`.
   - Keep "Enable sign ups" OFF (accounts are created by admins).
   - OTP length = 6 (matches what the app validates).
4. Create users through administrator Accounts or Authentication → Users.
   - Every account, including administrators, receives an immutable generated
     student login ID. Existing IDs and passwords are preserved. Apply the
     `20261029133532_all_account_student_ids.sql` migration for older accounts.
   - Student accounts are assigned during enrollment. The sign-in page does not
     offer self-registration or an access-request link.
   - Admin role is set server-side only, e.g.:
     ```sql
     UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}'::jsonb)
                            || '{"role":"admin"}'
     WHERE email = 'admin@your-school.edu.ph';
     ```
5. Make sure the database schema is current:
   - New project: run `supabase/schema.sql` once, then `supabase/seed.sql` if you
     want sample rows.
   - Existing project: apply only missing files in `supabase/migrations/` in
     order. Do **not** re-run `schema.sql` or the legacy blanket-access scripts
     on live data. Report privacy uses the existing
     `20261029030405_student_incident_privacy_and_minimal_reports.sql` migration.

### Self-service password recovery

In Authentication → URL Configuration, set the production Site URL to your app
and allow its exact recovery URL, for example
`https://osas.stagnesacademy-sms.com/?recovery=1`. For local testing, allow
`http://localhost:3000/?recovery=1` (and the `127.0.0.1` equivalent if used).
Preview deployments need their own allowed recovery URL. These hosted settings
must be updated in Supabase; changes to `supabase/config.toml` configure the
local project only.

“Forgot password?” sends a reset link to the account's registered inbox through
Supabase Auth. No admin approval or notification Edge Function is involved. The
app consumes the recovery link before dashboard startup, removes its tokens from
the address bar, and shows a new-password form. Saving ends the recovery session
and returns to the usual password plus email-code/PIN sign-in flow. A page refresh
keeps the recovery form; invalid or expired links offer a new reset email. The
temporary recovery client stores its session in the current tab's sessionStorage,
using a different key from normal sign-in, so other tabs cannot restore a recovery
token as a dashboard session.

To verify live delivery, use an existing test account: request a reset, follow the
received link, change the password, then sign in and complete the usual second
step. Confirm the old password no longer works. Also try the reset link again to
check the expired-link message. This requires working Auth SMTP and the allowed
redirect URL above.

## 2) Notification emails (Parent Notifications / stock alerts / event notices)

Notification emails are sent by the Supabase Edge Function
`supabase/functions/send-notification`. The frontend sends a validated payload to
that function; the function looks up recipients from the database and sends one
email per recipient.

The function is now configured to use **one** of these mail providers, in order:

- Maileroo: set `MAILEROO_API_KEY` (+ optional `MAILEROO_FROM`)
- SMTP: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

It also now requires the Supabase service-role key so it can read recipients and
write notification rows server-side:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set those secrets on the function, for example:

Maileroo:
```
supabase secrets set SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  MAILEROO_API_KEY=your-maileroo-api-key \
  MAILEROO_FROM="Saint Agnes Academy OSAS <osas@your-verified-domain>"
```

SMTP:
```
supabase secrets set SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  SMTP_HOST=smtp.your-provider.com SMTP_PORT=587 \
  SMTP_USER=your-smtp-user SMTP_PASS=your-smtp-password \
  SMTP_FROM="Saint Agnes Academy OSAS <noreply@your-verified-domain>"
```

Deploy the function after changing it:
```
supabase functions deploy send-notification
```

If you restrict CORS, also set:
```
ALLOWED_ORIGIN=https://your-site.example
```

## 3) Live database data in the frontend

The frontend now reads Supabase config from environment/config instead of being
hardcoded to one demo project. `js/config.js` checks, in order:

1. Values already set on `window.OSAS`
2. Server environment variables (`process.env`)
3. The Deno environment of the function runtime (`Deno.env`)
4. The built-in fallback values

That means you can run the app against a real project by providing:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NOTIFY_FN_URL` (if it differs from the default function URL)

If those are missing/empty, the app falls back to demo/mock mode and clearly
labels it as such. When a real session is present, the app uses live data only.

## 4) What was fixed

- `supabase/functions/send-notification/index.ts`
  - Now requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at startup and
    fails with a clear message if they are missing.
  - Supports Maileroo **or** SMTP, with an explicit "no email provider configured"
    error when neither is set.
  - Verifies the caller's Supabase session and restricts campus-wide broadcasts
    to admins.
- `js/config.js`
  - No longer hardcodes one demo Supabase project as the only option.
  - Reads live config from environment/config so the app can be pointed at a real
    database.
- `js/auth.js`
  - The OTP/magic-link send path now explains provider-not-configured errors
    instead of a generic failure.
  - Added `emailDeliveryAvailable()` so the login screen can warn when Supabase
    Auth email is not working.
- `js/modules/notifications.js`
  - The notification composer no longer sends unsupported
    `student_name`/`student_grade` fields in incident alerts. The Edge Function
    and database do not store those fields; recipient/student details are derived
    server-side from `student_id`.
- `.env.example` guidance
  - Updated with the actual secrets and Supabase Auth email steps the fixed code
    now depends on.

## 5) If emails still fail after this

- For sign-in codes: check Supabase Authentication → Email and Email Templates.
  The app expects an OTP code in the email body.
- For notification emails: check the function secrets and deploy output. If the
  function starts with "Missing SUPABASE_SERVICE_ROLE_KEY" or "No email provider
  is configured," that is the problem.
- If the function returns `delivery.status = failed`, the error field will name
  the provider issue (for example Maileroo 401, or SMTP auth failure).

## Administrator PIN sign-in

Email verification codes are used for student sign-in. Administrators enter their email/password and then a four-digit PIN; their first sign-in prompts them to choose and confirm it. Deploy the `admin-pin` function after its migration. It verifies the authenticated admin role and password authentication, stores only bcrypt hashes privately, and locks PIN attempts for 15 minutes after five failures. No OTP email is sent during routine administrator sign-in. Account emails and passwords are preserved.
