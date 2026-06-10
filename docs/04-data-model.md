# Data Model

## Entities (implemented)

- User (Django User)
- ApplicantProfile — verified, pseudonymized identity; stores only an
  HMAC-SHA256 hash of the personal identity number (docs/08)
- Organization — employer organization (name, org_number)
- EmployerProfile — links a user to an organization with a role (admin/member)
- JobPosting — job ad owned by an organization; unique on (source, external_id)
  for imported postings
- JobApplication — applicant's application event for a posting
  (applied_at, status); immutable via the API after creation
- AuditLog — append-only trail (actor, action, target, metadata, timestamp);
  actions: application.created, application.deleted, applications.disclosed,
  applications.disclosed_partner
- PartnerClient — authorized partner system (e.g. A-kassa); API key stored
  as SHA-256 hash, issued once via the create_partner management command

## Entities (future)

- Consent/Authorization

## PII classification (draft)

- Direct identifiers: username/email on User; personal identity number
  (never stored — pseudonymized via keyed hash in ApplicantProfile)
- Indirect identifiers: job ad id, employer org id, timestamps
  (may become identifying when combined)

## Notes

- Prefer pseudonymous internal identifiers
- Store minimal payload needed for verification
- AuditLog.metadata holds ids and counts only — no PII, since entries are
  retained after the underlying records are deleted (actor is SET_NULL)
