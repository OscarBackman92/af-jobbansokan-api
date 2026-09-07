# API Spec

Base path for domain resources: `/api/v1/`

Interactive schema (debug or staff only in production):

- `/api/schema/`
- `/api/docs/`

OpenAPI version in settings: `0.2.0`. Authenticated endpoints use Bearer
JWT. Default list page size is 20; clients may pass `?page_size=` up to
200.

## Public site (no `/api/v1` prefix)

- `GET /` — marketing landing
- `GET /integritet/`, `/om/`, `/faq/`
- `GET /app/`, `/app/<path>` — React SPA
- `GET /health/` — `{ "status": "ok" }` plus `warnings` when e-mail is
  misconfigured
- `GET /runtime-config.js` — optional frontend Sentry DSN
- `GET /.well-known/security.txt` — 404 until `CONTACT_EMAIL` is set
- `GET /robots.txt`, `/sitemap.xml`, `/llms.txt`

## Auth (`/dj-rest-auth/`)

- `POST /dj-rest-auth/registration/` — create account; sends verification
  mail; **201 with a message, no JWT** until the address is verified
- `POST /dj-rest-auth/registration/verify-email/`
- `POST /dj-rest-auth/registration/resend-email/`
- `POST /dj-rest-auth/login/` — e-mail + password; returns access + refresh
- `POST /dj-rest-auth/logout/`
- `GET` / `PATCH /dj-rest-auth/user/`
- `POST /dj-rest-auth/google/` — exchange Google OAuth `code` for JWT
  (requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`; SPA hides the
  button when unset)
- `POST /dj-rest-auth/token/refresh/` — rotated refresh (throttled
  separately from login, default 30/min)
- `POST /dj-rest-auth/token/verify/`
- `POST /dj-rest-auth/password/reset/`
- `POST /dj-rest-auth/password/reset/confirm/`
- `POST /dj-rest-auth/password/change/`

Password change and reset revoke all outstanding refresh tokens.

## Profile

- `GET /api/v1/me/`
- `PATCH /api/v1/me/` — `first_name`, `last_name`
- `DELETE /api/v1/me/` — GDPR erasure (account and owned data)

Response includes read-only `operator_id`.

## Resume

- `GET /api/v1/me/resume/` — empty row created on first GET
- `PUT` / `PATCH /api/v1/me/resume/`
- `DELETE /api/v1/me/resume/`
- `POST /api/v1/me/resume/parse/` — PDF, DOCX or TXT (max 2 MB); draft
  only, file never stored
- `POST /api/v1/me/resume/evidence/` — add one evidence term to the
  active job profile (`term`, `category` technical/domain/languages)
- `POST /api/v1/me/resume/suggest-evidence/`
- `POST /api/v1/me/resume/suggest-skills/`

## Saved searches

- `GET /api/v1/me/saved-searches/`
- `POST /api/v1/me/saved-searches/`
- `GET /api/v1/me/saved-searches/{id}/`
- `PATCH /api/v1/me/saved-searches/{id}/`
- `DELETE /api/v1/me/saved-searches/{id}/`

## Dashboard and insights

- `GET /api/v1/dashboard/` — Översikt payload (kpis, funnel,
  next_actions, monthly, outcomes, response_by_match, top_companies,
  waiting_age, pace)
- `GET /api/v1/insights/skills/` — aggregated skill hits/gaps from
  stored match snapshots

## Applications

- `GET /api/v1/applications/` — lean rows without `events`
- `POST /api/v1/applications/`
- `GET /api/v1/applications/{id}/` — full row including `events`
- `PATCH /api/v1/applications/{id}/`
- `DELETE /api/v1/applications/{id}/`
- `POST /api/v1/applications/{id}/events/`
- `GET /api/v1/applications/tracked-urls/` — every `ad_url` including
  soft-archived rows (duplicate protection for ad search)
- `GET /api/v1/applications/saved-summary/` — wishlist lane counts
- `POST /api/v1/applications/bulk/` — `{ids, action, date?}` for
  `mark_applied` / `archive` / `pause` / `activate` / `set_apply_by`
- `GET /api/v1/applications/similar/` — notice-only duplicates
  (`company`, `title`, `source_job_id`, `exclude`)
- `GET /api/v1/applications/export/` — CSV (filters apply)

List filters:

- `status`
- `search` (company, title, notes)
- `from` / `to` (`applied_at`)
- `archived` (`1` = soft-archived rows only; default hides them)
- `page_size` (max 200)

Wishlist/Ansökningar fields: `intent`, `apply_by`, `apply_by_is_auto`,
`archived_at`, plus read-only `days_until_apply_by` and `days_waiting`.
`status` ids are unchanged. `stage` and `outcome` are derived.

Creating an application accepts free-text fields (`company`, `title`, …)
or an optional legacy `posting` id (historical DB reference only).

## Jobs (live Platsbanken)

- `GET /api/v1/jobs/` — live search
- `GET /api/v1/jobs/filters/` — region + occupation-field options
- `GET /api/v1/jobs/occupations/` — occupation-name autocomplete (`?q=`)
- `GET /api/v1/jobs/groups/` — occupation groups for a selected field
- `GET /api/v1/jobs/municipalities/` — municipalities for a selected region
- `GET /api/v1/jobs/{job_id}/` — one ad by JobTech id (snapshot refresh)

Job search parameters:

- `q`
- `region` / `regions`
- `municipality` / `municipalities`
- `field` / `fields`
- `group` / `groups`
- `remote`
- `offset`, `limit`
- `match_cv`, `min_match` (0–100), `sort=match`, `hide_blocked`

CV skills, when present, add a `match` object to each hit. Identical
unfiltered searches are cached server-side for 3 minutes.

## Report periods (AF helper)

Period key: `YYYY-MM`.

- `GET /api/v1/periods/` — `{ "results": [...] }`
- `GET /api/v1/periods/{key}/`
- `POST /api/v1/periods/{key}/submit/`
- `POST /api/v1/periods/{key}/reopen/`
- `GET /api/v1/periods/{key}/export/` — month CSV
- `POST /api/v1/periods/{key}/exclude/` — `{ kind: job|activity|event, id, excluded?, note? }`

## Activities

ViewSet, own rows only:

- `GET` / `POST /api/v1/activities/`
- `GET` / `PUT` / `PATCH` / `DELETE /api/v1/activities/{id}/`
