# SAAC – OSAS Dashboard

School safety & compliance system for the Office of Student Affairs and Services (OSAS) —
a role-based dashboard for managing student safety, emergency preparedness, and compliance.

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | HTML + CSS + JavaScript (vanilla, no build step) |
| Backend   | PHP 8 (REST API) |
| Database  | Supabase (PostgreSQL) with Row Level Security |
| Auth      | Supabase Auth (email + password / magic link) |
| Storage   | Supabase Storage (`evacuation-maps`, `inspection-photos`) |
| API       | RESTful JSON |
| Version Control | Git / GitHub |
| DevOps    | Vercel (frontend) + Render (backend, via Docker) |

## Features

- **10 OSAS modules** — Emergency Contacts, Drill Scheduling, Evacuation Maps (file upload + versioning),
  Incident Logging, Safety Inspections (photo proof), Risk Assessment, Parent Notifications
  (incident alerts vs event notices), Compliance Reports (CSV/PDF export), Emergency Role Assignment,
  First Aid Supplies (auto low-stock flagging).
- **Role-based access** — Admin (full) vs Staff (view + log; no admin-only areas). Enforced on the
  frontend, in the PHP API middleware, **and** via Supabase RLS.
- **Dashboard analytics** — KPI cards and two donut charts (incident type breakdown, inspection status)
  computed live from the database.
- **Cross-module automation** — incident save → "Notify parent?" (auto `incident_alert` via call/SMS),
  drill schedule → optional `event_notice`, supplies below threshold → auto "Low" flag.
- **Audit log** — insert/update/delete recorded for incidents, inspections, notifications, and supplies.
- **Server-side validation** on every PHP POST/PATCH plus matching DB-level CHECK constraints.
- **Dev fallback** — with no Supabase keys and no API reachable, the UI runs on a built-in demo
  dataset; the PHP API likewise runs in mock mode (JSON-file store). Everything switches to live
  Supabase the moment the env vars exist.

## Folder Structure

```
frontend/
  index.html            # app shell (sidebar, topbar, login overlay)
  css/osas.css          # design tokens (maroon/cream/pink) + helpers
  js/
    config.js           # runtime config (API URL, Supabase keys)
    ui.js               # shared DOM builders (tables, pills, donut charts…)
    api.js              # data layer: PHP API first, mock fallback
    auth.js             # Supabase Auth (client-side) + dev session
    mock.js             # demo dataset used when nothing is configured
    app.js              # bootstrap: shell, hash router, login, dashboard
    modules.js          # the 10 module pages
  assets/               # logo files
backend/                # PHP REST API (no Composer deps)
  public/index.php      # front controller + routing
  router.php            # dev server router (static + /api)
  src/
    Db.php              # Supabase REST (cURL) / JSON-file mock store
    Auth.php            # JWT verification + role middleware
    Validation.php      # per-table required/enum checks
    Notifications.php   # send endpoint + Twilio call/SMS stub
    MockStore.php       # in-memory dataset + persistence
  supabase/schema.sql   # tables, CHECK constraints, RLS, storage buckets
  seed.php              # demo data + demo auth users
  storage/              # JSON mock store + local upload fallback
  .env.example
  Dockerfile            # Render deployment
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run `backend/supabase/schema.sql` — creates all tables,
   CHECK constraints, RLS policies, Realtime publication, and the two storage buckets.
3. Copy the **Project URL**, **anon key**, **service-role key**, and **JWT secret**
   (Settings → API) for the env steps below.

### 2. Run the app (dev)

The PHP built-in server serves the static frontend *and* the API from one process:

```bash
php -S 127.0.0.1:5173 -t . backend/router.php
# open http://localhost:5173
```

> On Windows with XAMPP: `C:\xampp\php\php.exe -S 127.0.0.1:5173 -t . backend/router.php`

Without any env vars the API runs in **mock mode** (JSON-file store) and the login screen
accepts any credentials — the app boots straight into a demo Admin session.

### 3. Seed demo data (optional)

```bash
# Mock mode — resets the demo dataset:
php backend/seed.php

# Supabase mode — run schema.sql first, then:
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
php backend/seed.php --reset-tables
```

Creates demo logins via the Supabase Auth admin API and realistic records across all tables.

### 4. Demo accounts

| Email | Role | Password |
|-------|------|----------|
| `admin@saac.ph` | Admin | `admin1234` |
| `staff@saac.ph` | Staff | `staff1234` |

Staff see the same modules but admin-only areas (Risk Assessment, Safety Reports,
Emergency Roles) are hidden and their API writes to those tables return 403.

## Configuration

### Frontend (`js/config.js`)

```js
window.OSAS = {
  API_URL: '/api',               // full Render URL in production
  SUPABASE_URL: '',              // set for real Supabase Auth
  SUPABASE_ANON_KEY: '',
};
```

### Backend (`.env` / Render env vars)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (service client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — never expose client-side |
| `SUPABASE_JWT_SECRET` | Verifies the client's access token on every request |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS/call delivery — stub logs until set |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email delivery — optional |
| `PORT` | API port (default 8080) |

Never hardcode secrets. Frontend values live in Vercel project settings;
backend values live in Render project settings.

## ERD

```mermaid
erDiagram
    users ||--o{ notifications : "created_by"
    users ||--o{ audit_log : "changed_by"
    students ||--o{ incidents : "student_id"
    students ||--o{ notifications : "student_id"
    incidents ||--o{ notifications : "related_incident_id"

    users {
        uuid id PK
        text role "admin | staff"
        text full_name
        text email
    }
    students {
        uuid id PK
        text name
        int grade "CHECK 7-12"
        text section
        text phone
    }
    emergency_contacts {
        uuid id PK
        text category "student | school"
        text name
        text relationship
        text role
        text phone
        text email
        int priority
    }
    drills {
        uuid id PK
        text type "Fire|Earthquake|Lockdown|Evacuation"
        date date
        text building
        text person_in_charge
        text status "upcoming|completed|cancelled"
        text notes
    }
    evacuation_plans {
        uuid id PK
        text building
        text floor
        text exits
        text routes
        text assembly_point
        text version
        date updated
        text file_url
        boolean current
    }
    incidents {
        uuid id PK
        date date
        text type "medical|slips/falls|fire-related|security|equipment failure"
        text location
        text description
        text reporter
        text severity "low|medium|high"
        text status "open|resolved"
    }
    inspections {
        uuid id PK
        text item
        text area
        text frequency
        date last_inspected
        text status "passed|pending|overdue|fail"
        text inspector
        text notes
        text photo_url
    }
    risks {
        uuid id PK
        text hazard
        text likelihood "Low|Medium|High"
        text impact "Low|Medium|High"
        text risk_level "Low|Medium|High|Critical"
        text mitigation
        text owner
        date review_date
    }
    notifications {
        uuid id PK
        text notif_type "incident_alert|event_notice"
        text priority "urgent|informational"
        text audience_group
        text title
        text message
        timestamptz event_start_at
        timestamptz event_end_at
        text contact_method "app|sms|call|email"
        timestamptz sent_at
        text delivery_status "pending|sent|failed|delivered|read"
    }
    emergency_roles {
        uuid id PK
        text role
        text staff
        text zone
        text backup
    }
    supplies {
        uuid id PK
        text item
        int quantity
        text unit
        text location
        date expiry
        int reorder_threshold
        date last_restocked
    }
    reports {
        uuid id PK
        text name
        text scope
        text format "PDF|Excel|CSV"
        date generated
        text url
    }
    audit_log {
        uuid id PK
        text table_name
        text record_id
        text action "insert|update|delete"
        jsonb old_value
        jsonb new_value
        timestamptz changed_at
    }
```

## Deployment

### Frontend — Vercel

1. Import the GitHub repo in Vercel.
2. No framework preset needed — it's a static site. Root directory: `frontend`.
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (used by `js/config.js`) in
   project settings → Environment Variables (prefixed as `VITE_` only if you
   build with Vite; this project reads them from `window.OSAS`).
4. Deploy. Vercel auto-deploys on every push to `main`.

### Backend — Render

Render has no native PHP runtime, so the backend ships as a Docker image:

1. New **Web Service** → connect the same GitHub repo.
2. Root directory: `backend`; runtime **Docker** (uses `backend/Dockerfile`).
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and any
   Twilio/SMTP keys in the Environment section.
4. Deploy. Render auto-deploys on every push to `main`.
5. Point the frontend at it: set `API_URL` in `js/config.js` (or via a Vercel
   env var / rewrite) to `https://your-api.onrender.com/api`.

> CORS: the API currently allows all origins. Lock it down in
> `backend/public/index.php` before production.
