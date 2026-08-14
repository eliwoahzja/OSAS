# SAAC – OSAS Dashboard

Safety and compliance dashboard for the Office of Student Affairs and Services. Keeps emergency contacts, drills, incident reports, inspections, and parent notifications in one place.

The app is a module of a bigger system. The login page lives in a companion app; this module just needs a Supabase session (see [Companion app](#companion-app) below).

## Stack

- Frontend: plain HTML/CSS/JS in `frontend/` (no build step, no framework)
- Database: Supabase (PostgreSQL) with row-level security
- Email: Maileroo via the `send-notification` Edge Function (free tier, no card)
- Hosting: Vercel for the site, Supabase for data + the one Edge Function

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `frontend/supabase/schema.sql`, then `frontend/supabase/seed.sql` for sample data.
3. Deploy the notification function:

   ```bash
   cd frontend
   supabase init
   supabase link --project-ref <your-project-ref>
   supabase functions deploy send-notification
   supabase secrets set MAILEROO_API_KEY=<key> MAILEROO_FROM="SAAC OSAS <notifications@<you>.maileroo.net>"
   ```

   Get the Maileroo API key and free sender address from [maileroo.com](https://maileroo.com) (3,000 emails/month free, no card, they give you a sender domain).

4. Put the URL the deploy command prints into `frontend/js/config.js` → `NOTIFY_FN_URL`.

## Running locally

```bash
cd frontend
npx serve .
```

With no Supabase session around, the app falls back to a demo dataset (`js/mock.js`) so you can still look around. Once a real session exists it reads and writes live Supabase data.

## Deploying to Vercel

Import the repo, root directory `frontend`. It's a static site — no build step. Every push auto-deploys.

## Companion app

The companion owns login and hands this module a session either by setting `window.OSAS.accessToken` before the scripts load, or by signing in with the same Supabase project so the shared session in localStorage is picked up. Roles (admin vs staff) are enforced in the UI and by RLS.

## Notes

- SMS/call were removed — no budget for them. Notifications are in-app + email only.
- `contact_method` is `app` or `email`. Incident alerts always email the student's parents.
