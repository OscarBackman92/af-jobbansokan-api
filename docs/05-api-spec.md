# API Spec

Base path: `/api/v1/`

Interactive schema:

- `/api/schema/`
- `/api/docs/`

## Auth

- `POST /dj-rest-auth/registration/`
- `POST /dj-rest-auth/login/`
- `POST /dj-rest-auth/token/refresh/`
- `POST /dj-rest-auth/password/reset/`
- `POST /dj-rest-auth/password/reset/confirm/`

## Profile

- `GET /api/v1/me/`
- `PATCH /api/v1/me/`
- `DELETE /api/v1/me/`

Deleting the profile deletes the account and owned data.

## Resume

- `GET /api/v1/me/resume/`
- `PUT /api/v1/me/resume/`
- `DELETE /api/v1/me/resume/`
- `POST /api/v1/me/resume/parse/`

`parse` accepts PDF, DOCX or TXT and returns a structured draft without storing
the uploaded file.

## Saved searches

- `GET /api/v1/me/saved-searches/`
- `POST /api/v1/me/saved-searches/`
- `DELETE /api/v1/me/saved-searches/{id}/`

## Applications

- `GET /api/v1/applications/`
- `POST /api/v1/applications/`
- `GET /api/v1/applications/{id}/`
- `PATCH /api/v1/applications/{id}/`
- `DELETE /api/v1/applications/{id}/`
- `POST /api/v1/applications/{id}/events/`
- `GET /api/v1/applications/export/`

List filters:

- `status`
- `search`
- `from`
- `to`

Creating an application accepts either free-text fields (`company`, `title`, …)
or an optional legacy `posting` id (historical DB reference only).

## Jobs (live Platsbanken)

- `GET /api/v1/jobs/`
- `GET /api/v1/jobs/filters/`
- `GET /api/v1/jobs/groups/`
- `GET /api/v1/jobs/municipalities/`

Job search parameters:

- `q`
- `region`
- `municipality`
- `field`
- `group`
- `remote`
- `offset`
- `limit`

CV skills, when present, add a `match` object to each hit.
