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

## Next Mitigations

- Add rate limiting for auth, uploads and live search.
- Move token storage to a safer cookie-based setup if the deployment shape
  allows it.
- Add Sentry and structured security logging.
- Add frontend accessibility and keyboard-flow tests.
- Prefix dangerous CSV cells if spreadsheet injection becomes a concern.
