# OSAS Campus Safety & Disaster Risk Reduction System

**Office of Student Affairs & Services (OSAS)**  
St. Anthony Academic Center (SAAC) — Campus Disaster Risk Reduction & Management Council (CDRRMC)

---

## Overview

The **OSAS Campus Safety & Emergency Management System** is a lightweight, offline-first web portal designed to monitor, log, and coordinate emergency preparedness protocols across campus grounds. Built in alignment with **Department of Education (DepEd) Order No. 48, s. 2012** (*Quarterly Conduct of the National Simultaneous Earthquake Drill*) and **National Disaster Risk Reduction and Management Council (NDRRMC)** guidelines, the system unifies campus incident reporting, quarterly evacuation drill logs, routine facility safety inspections, medical inventory replenishment, and quantitative hazard assessments.

Data privacy and student confidentiality are strictly enforced in compliance with Republic Act No. 10173 (**Data Privacy Act of 2012**).

---

## Core Capabilities

### 1. Incident Reporting & Triage
* Real-time logging of campus security breaches, medical emergencies, and facility hazards.
* Severity classification: *Low, Medium, High, and Critical*.
* Integrated notification dispatch with immediate guardian contact lookup.

### 2. Quarterly Drill Management & Evacuation Plans
* Pre-scheduled earthquake, fire, and lockdown evacuation exercises.
* Target evacuation clearance benchmarks (< 4 minutes per NDRRMC standards).
* Interactive campus floor plan registry showing primary and secondary evacuation corridors.

### 3. Facility Safety & Medical Supply Monitoring
* Routine checklist tracking for fire suppression equipment, AED units, structural exits, and lab eye-wash stations.
* Automatic reorder alerts when critical medical supplies fall at or below designated threshold quantities.
* One-click **"Notify Stock Handlers"** alert dispatching immediate replenishment notices to the School Nurse and clinic staff.

### 4. Quantitative Hazard Risk Scoring
* Mathematical risk score evaluation using multi-factor compounding parameters:
  $$\text{Risk Score} = (\text{Threat} \times \text{Vulnerability} \times (\text{Exploit Likelihood} \times \text{Exploit Impact}) \times \text{Asset Value}) - \text{Security Controls}$$
* Plain-language contextual rationale and recall rules for school administrators and emergency wardens.

### 5. Automated Compliance Export
* Instant CSV and print-ready PDF export for annual CDRRMC audits and division accreditation reviews.

---

## Tech Stack & Architecture

* **Frontend:** Modern Vanilla JavaScript (ES Modules), Tailwind CSS v4, custom reactive DOM builder (`js/ui.js`), SVG data visualization (`js/charts.js`).
* **Backend / API:** Supabase (PostgreSQL with Row Level Security), with a transparent client-side mock adapter (`js/mock.js`) for seamless offline operation.
* **Server Runtime:** Node.js with Express static file server (`server.ts`).
* **Tooling:** Vite, ESBuild, custom AST syntax linter (`scripts/lint.mjs`).

```
OSAS/
├── index.html              # SPA entrypoint and modal containers
├── server.ts               # Express static serving layer
├── package.json            # Dependencies and npm scripts
├── js/
│   ├── app.js              # Hash router, layout shell, and dashboard stats
│   ├── api.js              # REST client and localStorage mock adapter
│   ├── auth.js             # Session management and role resolution
│   ├── charts.js           # Lightweight custom SVG pie, donut & bar charts
│   ├── modal.js            # Accessible dialog controller
│   ├── mock.js             # Initial Philippine institutional demo dataset
│   ├── ui.js               # Common DOM builders, badges, and shell layout
│   └── modules/            # Isolated domain modules
│       ├── drills.js       # Evacuation drills and floor plans
│       ├── incidents.js    # Incident logs and emergency contacts
│       ├── inspections.js  # Facility inspections, roles, and supplies
│       ├── notifications.js# Parent and staff notification dispatch
│       ├── reports.js      # Audit compliance metrics and CSV export
│       ├── risk.js         # Quantitative risk matrix calculation
│       ├── risk-rationale.js # Natural language risk explanations
│       └── table-loader.js # Dynamic table view with client-side filtering
└── scripts/
    └── lint.mjs            # Recursive syntax and module import validator
```

---

## Getting Started

### Prerequisites
* Node.js v18.0.0 or higher
* npm v9.0.0 or higher

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/eliwoahzja/OSAS.git
   cd OSAS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables (optional):**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Note: If no Supabase credentials are provided, OSAS automatically boots in offline Demo Mode using local mock storage.*

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000`.

5. **Run the codebase linter:**
   ```bash
   npm run lint
   ```

---

## Security & Privacy Considerations

* **Data Privacy Act of 2012 (RA 10173):** Minor student identifiers, guardian phone numbers, and home addresses are masked in public table views and only decrypted during authorized incident escalation.
* **Session Expiry:** Client sessions automatically refresh token expiry against Supabase Auth, gracefully degrading to local staff role fallbacks when connectivity drops.
* **SMS Gateway Throttling:** Automated parent broadcasts are structured in 25-recipient batches with artificial delays to prevent mobile carrier rate-limiting (HTTP 429).

---

## License

Internal proprietary software developed for St. Anthony Academic Center (SAAC). Distributed under the MIT License for educational and disaster risk reduction demonstration purposes.
