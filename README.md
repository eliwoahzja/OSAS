# SAAC – OSAS Dashboard

School safety & compliance system for the Office of Student Affairs and Services (OSAS) —
a role-based dashboard for managing student safety, emergency preparedness, and compliance.

## Architecture

- **Frontend**: HTML + CSS + JavaScript (vanilla, no build step) — `frontend/`
- **Backend**: PHP 8 REST API — `frontend/backend/`
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email + password / magic link)
- **Storage**: Supabase Storage (`evacuation-maps`, `inspection-photos`)
- **API**: RESTful JSON (PHP, served by the built-in server in dev, Docker on Render)
- **DevOps**: Vercel (frontend) + Render (backend)

## Layout

```
frontend/
  index.html          # app shell (sidebar, topbar, login overlay)
  css/  js/           # design system + vanilla-JS modules (no framework)
  assets/             # logos
  backend/            # PHP REST API + Supabase schema + seed script
    public/index.php  # front controller
    src/              # Db (Supabase REST + mock), Auth (JWT), Validation, Notifications
    supabase/schema.sql
    seed.php
    Dockerfile        # Render deployment
  README.md           # full docs: setup, env vars, ERD, deployment
```

## Quick start

```bash
# dev (serves the static frontend AND /api from one process)
php -S 127.0.0.1:5173 -t . backend/router.php
# Windows (XAMPP): C:\xampp\php\php.exe -S 127.0.0.1:5173 -t . backend/router.php
```

With no env vars the API runs in mock mode (JSON-file store) and the app boots into a
demo Admin session. See `frontend/README.md` for Supabase setup, seeding, env vars,
the ERD, and Vercel/Render deployment.
