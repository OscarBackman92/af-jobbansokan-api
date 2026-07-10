# Jobbsöket

![CI](https://github.com/OscarBackman92/af-jobbansokan-api/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.13-blue)
![Django](https://img.shields.io/badge/django-5.2-092e20)
![DRF](https://img.shields.io/badge/DRF-3.16-a30000)

**Koll på hela ditt jobbsök.** Job seekers build their own Excel sheets to
track applications — statuses, recruiter calls, interviews, next steps.
Jobbsöket (formerly "Ansökt") is that sheet, done right: a kanban board
over your applications, a timeline per application, search over
Platsbanken's job ads, and CSV export because the data is yours.

> Production: [jobbjungeln.onrender.com](https://jobbjungeln.onrender.com)
> (Frankfurt). Cron jobs still use the `ansokt-*` service names from the
> original deploy.

> Pivoted 2026-06-12 from the earlier "verifiable job application events
> for A-kassa" concept — see [docs/10-pivot-ansokt.md](docs/10-pivot-ansokt.md)
> for the rationale and what changed.

## Features

- **Ansökningar** — översikt över aktiva ansökningar med snabbfilter och
  statusbyte:
  Sparad → Ansökt → Telefonintervju → Intervju → Skickad vidare →
  Erbjudande, with closed ones (Accepterat/Avslag/Inget svar/Återkallad)
  in an archive. Cards show a deadline badge as the last application day
  approaches
- **Follow-ups** — a section that surfaces rows whose next-step date has
  passed or whose deadline is within a week
- **Timeline per application** — notes, calls and interviews; status
  changes are logged automatically
- **Free-text rows** — track applications from anywhere (LinkedIn,
  e-mail, tips), not just imported ads
- **Job ad search** — searches all of Platsbanken **live** via
  Arbetsförmedlingen's open
  [JobTech JobSearch API](https://jobsearch.api.jobtechdev.se) (free, no
  API key), with filters for region, occupation field and remote; save
  an ad to the board with one click
- **CV** — upload a PDF/DOCX/TXT and it's parsed (in memory, never
  stored, using pypdf layout mode) into an always-visible, editable CV
  whose skills are matched against ad texts (boundary-aware, so "Go"
  doesn't match "Django")
- **Statistics** — applications per month and how many reached a
  call/interview or further
- **CSV export** (data portability)
- **Password reset by e-mail** and transparent JWT refresh, so a session
  never drops mid-task
- **E-mail based accounts** (registration + login via dj-rest-auth),
  with transparent JWT refresh so a session never drops mid-task;
  OpenAPI 3 schema with Swagger UI, modern admin
  ([django-unfold](https://unfoldadmin.com/))

## Architecture

```mermaid
flowchart LR
    U[User] -- JWT --> API[Django/DRF API]
    API --> DB[(PostgreSQL/SQLite)]
    API -- live search --> JT[JobTech JobSearch API]
```

| Layer | Technology |
| --- | --- |
| API | Django 5.2 + Django REST Framework 3.16 |
| Auth | dj-rest-auth + allauth (e-mail login) + SimpleJWT (15 min access, 7 d refresh, rotation + blacklist); SPA refreshes the access token on 401 |
| Database | SQLite (local dev) / PostgreSQL via `DATABASE_URL` (prod, required when `DJANGO_DEBUG=0`) |
| API docs | drf-spectacular (OpenAPI 3 + Swagger UI) |
| Frontend | React 19 + Vite (in `frontend/`) |
| Quality | pytest, ruff, black — enforced in GitHub Actions CI |

## API overview

Base path: `/api/v1/` — full interactive docs at `/api/docs/`.

| Endpoint | Method | Notes |
| --- | --- | --- |
| `/health/` | GET | Health check (no `/api/v1` prefix) |
| `/dj-rest-auth/registration/` | POST | Create account by e-mail; sends verification mail (no JWT until verified) |
| `/dj-rest-auth/login/` | POST | Log in by e-mail; returns access + refresh token |
| `/dj-rest-auth/token/refresh/` | POST | Exchange the refresh token for a new access (+ rotated refresh) token |
| `/api/v1/me/` | GET, PATCH, DELETE | Own profile; DELETE = GDPR erasure |
| `/api/v1/me/resume/` | GET, PUT, DELETE | Structured CV |
| `/api/v1/me/resume/parse/` | POST | Parse uploaded CV to a draft — file never stored |
| `/dj-rest-auth/google/` | POST | Google login (optional; button hidden when `GOOGLE_CLIENT_ID` unset) |
| `/api/v1/applications/` | GET, POST | Tracker rows; `?status=&search=&from=&to=&page_size=` (list omits `events`) |
| `/api/v1/applications/{id}/` | GET, PATCH, DELETE | Edit status, deadline, notes, contacts — fully mutable; includes `events` |
| `/api/v1/applications/{id}/events/` | POST | Append a timeline event |
| `/api/v1/applications/tracked-urls/` | GET | All ad URLs on the board (lets the ad search mark saved ads cheaply) |
| `/api/v1/applications/export/` | GET | CSV download (filters apply) |
| `/api/v1/jobs/` | GET | **Live Platsbanken search**; `?q=&region=&field=&remote=&offset=&limit=`; CV match per hit; identical searches cached 3 min |
| `/api/v1/jobs/filters/` | GET | Region + occupation-field options for the search dropdowns |
| `/api/v1/jobs/groups/` | GET | Occupation groups for a selected field |
| `/api/v1/jobs/municipalities/` | GET | Municipalities for a selected region |
| `/api/v1/me/saved-searches/` | GET, POST | Saved Platsbanken search presets |

## Getting started

Requirements: Python 3.13+ (3.14 works), git.

```bash
git clone https://github.com/OscarBackman92/af-jobbansokan-api.git
cd af-jobbansokan-api

python -m venv .venv
.venv/Scripts/activate          # Windows  (source .venv/bin/activate on Unix)
pip install -r requirements.txt

cp .env.example .env            # set DJANGO_DEBUG=1 for local development

python backend/manage.py migrate
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

The **Annonser** tab searches Platsbanken live via `/api/v1/jobs/` — no
import or local ad database is required.

Then open:

- Swagger UI: <http://127.0.0.1:8000/api/docs/>
- Admin: <http://127.0.0.1:8000/admin/>
- Health check: <http://127.0.0.1:8000/health/>

### Frontend

The React/Vite app lives in `frontend/`: login/registration, the board,
ad search and profile/CV.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — Django must run on :8000
```

API calls are proxied by the Vite dev server, so no CORS configuration
is needed.

### Using PostgreSQL instead of SQLite

```bash
docker compose -f infra/docker-compose.yml up -d
```

Then set the `DB_*` variables in `.env` (the compose file maps Postgres to
host port **5433**) and run `migrate` again.

### A quick end-to-end tour

```bash
# 1. Register by e-mail (returns access + refresh JWT immediately)
curl -X POST http://127.0.0.1:8000/dj-rest-auth/registration/ \
  -H "Content-Type: application/json" \
  -d '{"email": "anna@example.com", "password1": "Testpass123!", "password2": "Testpass123!"}'

# 2. Add a free-text tracker row with a deadline
curl -X POST http://127.0.0.1:8000/api/v1/applications/ \
  -H "Authorization: Bearer <access token>" -H "Content-Type: application/json" \
  -d '{"company": "Acme AB", "title": "Backendutvecklare", "applied_at": "2026-06-09", "deadline": "2026-06-30"}'

# 3. Move it forward (auto-logs a timeline event)
curl -X PATCH http://127.0.0.1:8000/api/v1/applications/1/ \
  -H "Authorization: Bearer <access token>" -H "Content-Type: application/json" \
  -d '{"status": "screening"}'

# 4. When the access token expires, mint a new one with the refresh token
curl -X POST http://127.0.0.1:8000/dj-rest-auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh token>"}'
```

## Deployment

The repo is deploy-ready for [Render](https://render.com) (or any Docker
host):

- **One service serves everything**: the `Dockerfile` builds the frontend
  (Node stage), collects static files, and gunicorn + WhiteNoise serve
  the SPA at `/`, hashed assets, the API and the admin
- **`render.yaml` blueprint**: web service + cron jobs on Render; **Supabase**
  Postgres in production (`DATABASE_URL` set manually in Render dashboard)
- **Production hardening** activates when `DJANGO_DEBUG=0`: HSTS,
  SSL redirect (behind proxy header), secure cookies, manifest static
  storage, referrer policy
- **Env-driven bootstrap on boot** (free tier has no shell): creates the
  superuser (`DJANGO_SUPERUSER_USERNAME`/`_PASSWORD`) and syncs the
  public site domain from `FRONTEND_URL` — idempotent
- CI runs the backend tests against **Postgres 16** (same engine as
  production) plus the frontend build

Quick start: push to GitHub → render.com → **New → Blueprint** → select
the repo → **Apply**. Prefer to host the frontend on Vercel's CDN with
preview deploys? See [docs/11-deploy-vercel.md](docs/11-deploy-vercel.md)
for the split (frontend on Vercel, backend on Render).

### E-mail & password reset

Password reset sends an e-mail with a link back to the app. **In
development** no configuration is needed — Django's console backend
prints the e-mail (including the reset link) to the server log. **In
production the reset e-mail is only actually sent when SMTP is
configured**; without `EMAIL_HOST` set, reset silently no-ops from the
user's point of view.

Set these env vars in production (any SMTP provider — Brevo, Resend,
Postmark, …; the free tiers are enough):

| Variable | Purpose |
| --- | --- |
| `EMAIL_HOST` | SMTP host — **its presence switches on real e-mail** |
| `EMAIL_PORT` | SMTP port (default `587`) |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password / API key |
| `EMAIL_USE_TLS` | `1` (default) or `0` |
| `DEFAULT_FROM_EMAIL` | From address, e.g. `Jobbsöket <no-reply@dindomän.se>` |
| `FRONTEND_URL` | Base URL the reset link points at (e.g. `https://jobbjungeln.onrender.com`). Defaults to the request origin, which is correct for the single-service Render deploy; set it explicitly when the frontend is hosted separately (e.g. Vercel). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Enables "Fortsätt med Google": create an OAuth client in Google Cloud Console with the site URL (trailing slash) as authorized redirect URI. The login button is hidden while unset. |
| `CONTACT_EMAIL` | Public contact for privacy questions and vulnerability reports. Shown in the in-app privacy policy and served at `/.well-known/security.txt` (404 while unset). |

The `render.yaml` blueprint lists these with `sync: false`, so Render
prompts for the values at deploy time instead of baking them in.

## Testing and linting

```bash
pytest            # backend test suite
ruff check .
black --check .

cd frontend
npm test          # Vitest unit tests
npm run lint      # ESLint
npm run test:e2e  # Playwright smoke tests (starts backend + frontend itself)
```

The E2E suite boots its own stack: a throwaway Django backend (fresh
SQLite, mail written to files), a mocked JobTech server and the Vite dev
server — no manual setup, but run `npx playwright install chromium` once.

CI (GitHub Actions) runs everything on every pull request against `main`
and on every push to `main`.

The OpenAPI schema can be validated with:

```bash
python backend/manage.py spectacular --validate --fail-on-warn
```

## Project structure

```text
backend/
  config/              # Django settings, root URLconf, WSGI/ASGI
  core/                # The single domain app
    management/        #   bootstrap command
    migrations/
    tests/             #   pytest suite (applications, auth, jobs, resume, ...)
    models.py          #   JobApplication, ApplicationEvent, JobPosting, Resume
    jobtech.py         #   live Platsbanken search + region/field taxonomy
    matching.py        #   boundary-aware CV skill matching
    resume.py          #   CV extraction (pypdf layout mode) + parsing
    serializers.py     #   incl. Email register + password-reset serializers
    views.py
frontend/
  src/
    api.js             #   fetch wrapper with refresh-on-401
    auth.js            #   token storage + JWT refresh
    statuses.js        #   status pipeline shared with the backend
    components/        #   AuthHero, BoardPanel, ApplicationModal,
                       #   PostingsPanel, ProfilePanel, ResetPassword
  vercel.json          #   optional: proxy /api to the backend on Vercel
docs/                  # Vision, architecture, GDPR, pivot, deploy guides
infra/                 # docker-compose for local PostgreSQL
.github/               # CI workflow, issue/PR templates
```

## Privacy

- Users see only their own data; deletion of the account cascades to
  everything it owns (GDPR right to erasure)
- CSV export doubles as data portability
- Uploaded CV files are parsed in memory and never stored
- Notes may contain third-party contact details (recruiters) — covered
  in the privacy policy, removed with the account
- No analytics, no third-party cookies; the JWT (access + refresh) lives
  in localStorage
- Retention: accounts inactive for 24 months are deleted by the daily
  cron (`prune_inactive_accounts`) after a 30-day warning e-mail;
  logging in resets the clock
- Monday weekly summary e-mail with pipeline overview and new hits from
  saved Platsbanken searches (`send_weekly_summary`)
- Password change/reset revokes all outstanding refresh tokens
- Vulnerability reports: `/.well-known/security.txt` (served when
  `CONTACT_EMAIL` is set)

See [docs/06-gdpr-privacy.md](docs/06-gdpr-privacy.md),
[docs/16-incidentrutin.md](docs/16-incidentrutin.md) (incident response)
and [docs/17-registerforteckning.md](docs/17-registerforteckning.md)
(records of processing).

## Roadmap

The product is feature-complete for personal use and live at
<https://jobbjungeln.onrender.com>. The current focus is
[docs/15-vag-till-fardig-webapp.md](docs/15-vag-till-fardig-webapp.md)
and [docs/13-lanseringsplan.md](docs/13-lanseringsplan.md): EU hosting,
e-mail deliverability, retention, then mobile stores when the web app is stable.
Google login is prepared in code but not enabled in production (July 2026).

- [x] Live JobTech search with region/occupation/remote filters
- [x] Password reset by e-mail (Brevo HTTP API in production)
- [x] Mandatory e-mail verification + operator IDs
- [x] Reminders for `next_action_at` (daily cron e-mail)
- [x] Saved JobTech searches
- [x] Duplicate detection for tracked ads
- [x] Privacy policy page
- [x] Calendar export (ICS) for follow-ups and deadlines (Idag-panel)
- [x] Playwright E2E smoke tests in CI
- [x] Google login (code ready — needs OAuth client + env vars)
- [x] EU hosting: Render Frankfurt + Supabase Postgres (EU)
- [ ] Custom domain, uptime check and verified e-mail sender domain
- [x] Weekly summary e-mail (applications, follow-ups, saved-search digest)
- [ ] XLSX export alongside CSV
- [ ] JobStream API for continuous ad updates

## Documentation

| Document | Contents |
| --- | --- |
| [18-manuell-test-och-cron.md](docs/18-manuell-test-och-cron.md) | **Cron on Render + manual test checklist (desktop & mobile)** |
| [claude-chrome-testprompt.md](docs/claude-chrome-testprompt.md) | Copy-paste prompt for Claude in Chrome QA testing |
| [claude-chrome-verification-email-prompt.md](docs/claude-chrome-verification-email-prompt.md) | Claude in Chrome prompt to test signup verification e-mail |
| [claude-chrome-render-cron-prompt.md](docs/claude-chrome-render-cron-prompt.md) | Claude in Chrome prompt to create Render cron jobs (reminders + weekly summary) |
| [claude-chrome-supabase-prompt.md](docs/claude-chrome-supabase-prompt.md) | Claude in Chrome prompt to set up Supabase + migrate from Render Postgres |
| [claude-chrome-fix-email-prompt.md](docs/claude-chrome-fix-email-prompt.md) | Claude in Chrome prompt to fix Brevo/Render e-mail (no API keys in chat) |
| [claude-chrome-sprint1-2-qa-prompt.md](docs/claude-chrome-sprint1-2-qa-prompt.md) | Claude in Chrome QA for Sprint 1 & 2 UX (scroll, CV, board filters, match) |
| [claude-design-prompt.md](docs/claude-design-prompt.md) | Claude design/UX audit prompt (visual hierarchy, themes, mobile, top 5 fixes) |
| [claude-chrome-deploy-qa-prompt.md](docs/claude-chrome-deploy-qa-prompt.md) | Claude in Chrome QA for latest deploy (scroll, sprint 1–2, design fixes) |
| [chatgpt-manuell-test-prompt.md](docs/chatgpt-manuell-test-prompt.md) | Full manual test suite prompt for ChatGPT → structured report for Cursor |
| [19-sakerhetsaudit-2026-07-10.md](docs/19-sakerhetsaudit-2026-07-10.md) | **Security audit (July 2026)** |
| [14-sakerhet-produktion.md](docs/14-sakerhet-produktion.md) | Production security checklist (Render, Sentry, Brevo) |
| [15-vag-till-fardig-webapp.md](docs/15-vag-till-fardig-webapp.md) | **Master checklist: drift, kvalitet, retention, mobil (pausat)** |
| [13-lanseringsplan.md](docs/13-lanseringsplan.md) | Launch plan: hosting, go-public checklist, retention |
| [12-utvecklingsplan.md](docs/12-utvecklingsplan.md) | Earlier development plan (Phases 1–3, mostly done) |
| [10-pivot-ansokt.md](docs/10-pivot-ansokt.md) | **The pivot: rationale, product, legal, what changed** |
| [11-deploy-vercel.md](docs/11-deploy-vercel.md) | Deploy guide: frontend on Vercel, backend on Render |
| [08-identity-bankid.md](docs/08-identity-bankid.md) | Archived note: identity verification is out of scope |
| [01-vision-scope.md](docs/01-vision-scope.md) | Original vision (pre-pivot) |
| [02-architecture.md](docs/02-architecture.md) | Components and data flows |
| [04-data-model.md](docs/04-data-model.md) | Entities and PII classification (pre-pivot) |
| [06-gdpr-privacy.md](docs/06-gdpr-privacy.md) | GDPR considerations |
| [07-devops-ci-cd.md](docs/07-devops-ci-cd.md) | CI/CD setup |
