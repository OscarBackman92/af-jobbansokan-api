# DevOps & CI/CD

## Local development

- Backend: `python backend/manage.py runserver` (Python 3.13, Django
  `DJANGO_DEBUG=1`).
- Frontend: `cd frontend && npm run dev` (Vite on `:5173`, base `/app/`,
  proxies API calls to `:8000`).
- Optional Postgres: `docker compose -f infra/docker-compose.yml up -d`
  (Postgres 16 on host port **5433**). Set `DB_*` in `.env`.
- Without `DB_*` / `DATABASE_URL`, local debug uses SQLite.

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml` — pull requests to `main` and
pushes to `main`.

| Job | What it runs |
| --- | --- |
| `test` | ruff, black --check, pytest with `--cov-fail-under=70` against Postgres 16 |
| `frontend` | npm ci, ESLint, `tsc --noEmit`, Vitest, production build (Node 22) |
| `e2e` | Playwright Chromium smoke tests (self-booted Django + Vite, mocked JobTech) |
| `audit` | `pip-audit` + `npm audit --omit=dev --audit-level=high` (informational, `continue-on-error`) |

Dependabot (`.github/dependabot.yml`) opens weekly PRs for pip, npm,
Docker and GitHub Actions.

## Production deploy

- **Target:** Render Frankfurt, Docker runtime, plan Starter.
- **Blueprint:** `render.yaml` — web service `jobbjungeln` + three cron
  jobs. Database is **Supabase Postgres** (`DATABASE_URL` set manually
  in the Render dashboard; cron inherits it from the web service).
- **Public origin:** `https://jobbdjungeln.obackman.se`. `FRONTEND_URL`
  values that still point at `jobbjungeln.onrender.com` are rewritten to
  that origin (`backend/config/frontend_url.py`).
- **Container start:** `collectstatic` → `migrate` → `bootstrap` →
  `backfill_match_snapshots` → `backfill_occupations` → gunicorn
  (`Dockerfile` `CMD`).
- **Hardening** when `DJANGO_DEBUG=0`: `DATABASE_URL` required, HSTS,
  SSL redirect, secure cookies, CSP, Swagger limited to staff.

Cron jobs (UTC):

| Name | Schedule | Command |
| --- | --- | --- |
| `ansokt-reminders` | `0 6 * * *` | `send_reminders` |
| `ansokt-prune` | `15 6 * * *` | `prune_inactive_accounts` |
| `ansokt-weekly-summary` | `0 7 * * 1` | `send_weekly_summary` |

Each cron is a single argv command (no `&&` / `sh -c`). See
[18-manuell-test-och-cron.md](18-manuell-test-och-cron.md).

## Optional split

Frontend on Vercel + API on Render: [11-deploy-vercel.md](11-deploy-vercel.md).
Default is the single Docker service.

## Quality commands

```bash
pytest
ruff check .
black --check .
python backend/manage.py spectacular --validate --fail-on-warn
python backend/manage.py check --deploy

cd frontend
npm test
npm run lint
npm run typecheck
npm run test:e2e
```
