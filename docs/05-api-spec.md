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

## Applications

- `GET /api/v1/applications/`
- `POST /api/v1/applications/`
- `GET /api/v1/applications/{id}/`
- `PATCH /api/v1/applications/{id}/`
- `DELETE /api/v1/applications/{id}/`
- `POST /api/v1/applications/{id}/events/`
- `GET /api/v1/applications/stats/`
- `GET /api/v1/applications/export/`

List filters:

- `status`
- `search`
- `from`
- `to`

## Jobs

- `GET /api/v1/jobs/`
- `GET /api/v1/jobs/filters/`

Job search parameters:

- `q`
- `region`
- `field`
- `remote`
- `offset`
- `limit`

## Legacy Postings

- `GET /api/v1/postings/`
- `GET /api/v1/postings/{id}/`

The live `/jobs/` endpoint is the primary ad-search surface.
