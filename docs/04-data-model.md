# Data Model (Draft)

## Entities (draft)
- User (Django User)
- JobApplicationEvent
- AuditLog
- PartnerClient (future)
- Consent/Authorization (future)

## PII classification (draft)
- Direct identifiers: personal identity number (should be pseudonymized or stored minimally)
- Indirect identifiers: job ad id, employer org id, timestamps (may become identifying when combined)

## Notes
- Prefer pseudonymous internal identifiers
- Store minimal payload needed for verification

