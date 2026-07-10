# Security & Threat Model

## Assumptions

- Application rows, notes and CV data are personal data.
- Users should only ever see their own data.
- Uploaded CV files are processed in memory and are not stored.
- The public API is exposed to browsers and should be hardened for abuse.

## Top Risks

1. Account takeover through weak passwords or credential stuffing.
2. Token theft from browser storage.
3. Unauthorized access to another user's applications or CV.
4. Excessive data retention in uploaded CV files or logs.
5. Misconfigured production settings, hosts, CSRF origins or secrets.
6. Denial of service against auth, upload or JobTech proxy endpoints.
7. Broken password-reset email configuration.
8. CSV injection if exported spreadsheet fields are interpreted by Excel.
9. Upstream JobTech downtime or slow responses.
10. Accessibility gaps that block keyboard-only users.

## Current Mitigations

- DRF endpoints default to authenticated access.
- Querysets filter by `request.user`.
- Account deletion cascades to owned application and CV data.
- CV files are parsed in memory and never persisted.
- Production settings enable secure cookies, HSTS and SSL redirect when debug is
  off.
- JobTech requests have a timeout and return a friendly 502 on upstream failure.
- Password reset avoids account enumeration.
- Rate limiting on API, auth (`dj_rest_auth` 5/min), uploads and JobTech proxy.
- CSV export cells are sanitized against spreadsheet formula injection.
- Swagger/OpenAPI docs require staff in production (`DebugOrAdminPermission`).
- Content-Security-Policy and related headers in production middleware.
- Mandatory e-mail verification before API access.

## Next Mitigations

- Move token storage to httpOnly cookies if the deployment shape allows it.
- Remove sensitive tokens from URL query parameters (verify/reset links).
- JSON size limits on CV fields in serializers.

## Implemented since initial draft

- Account enumeration on password reset avoided (same 200 for unknown e-mails).
- `pip-audit` and `npm audit` in CI (`.github/workflows/ci.yml`, audit job).
- Production requires `DATABASE_URL` when `DEBUG=0` (`settings.py`).
- Docker: `collectstatic` at container start, not image build (`Dockerfile`).

## Audit log

| Date | Document |
|------|----------|
| 2026-07-10 | [19-sakerhetsaudit-2026-07-10.md](19-sakerhetsaudit-2026-07-10.md) |
