# API Spec

## Conventions

- Base path: /api/v1/
- JSON by default
- OpenAPI schema: GET /api/schema/ (Swagger UI at /api/docs/)
- List endpoints are paginated (page number style, 20 per page, `?page=N`)
- Idempotency keys for write endpoints (future)

## Endpoints

### Public

- GET /health/
- GET /api/v1/postings/ and GET /api/v1/postings/{id}/ — public read

### Auth (dj-rest-auth + JWT)

- POST /dj-rest-auth/login/, /dj-rest-auth/logout/, /dj-rest-auth/token/refresh/
- POST /dj-rest-auth/registration/

### Auth (mock BankID — see docs/08-identity-bankid.md)

- POST /api/v1/auth/bankid/initiate/ `{personal_number}` → `{order_ref}`
- POST /api/v1/auth/bankid/collect/ `{order_ref}` → JWT pair + verified,
  pseudonymized identity (ApplicantProfile); audit logged as
  identity.verified. Returns 503 unless BANKID_MOCK=1.

### Applicant

- GET /api/v1/me/ — profile incl. identity (BankID) and employer status
- PATCH /api/v1/me/ — update contact details (email, first/last name)
- DELETE /api/v1/me/ — GDPR erasure: removes the account and its
  applications; audit logged as account.deleted, entries survive with
  the actor anonymized
- POST /api/v1/applications/ — register an application event (audit logged);
  one application per posting, applied_at cannot be in the future
- GET /api/v1/applications/?from=&to=&status= — list own events,
  filterable on applied_at date range and status
- GET /api/v1/applications/{id}/
- DELETE /api/v1/applications/{id}/ — audit logged
- Application events are immutable: PUT/PATCH are not allowed (405)

### Employer

- POST/PUT/PATCH/DELETE /api/v1/postings/ — employer admins only,
  postings are created for the admin's own organization
- GET /api/v1/employer/applications/ — applications to the employer's own
  organization; every call is audit logged as a disclosure

### Partner (A-kassa)

- Auth: `Authorization: Api-Key <key>` — keys are issued with the
  `create_partner` management command and stored hashed
- GET /api/v1/partner/application-events/?person=&from=&to= — application
  events for one person (personal identity number, YYYYMMDDNNNN) and time
  period; lookup happens via keyed hash so the number is never stored;
  least privilege response (no applicant identifiers, no status); every
  call is audit logged as a partner disclosure. Unknown persons return an
  empty list — the endpoint never reveals who has an account

### Future

- OAuth2/mTLS for partner integration
- CSV/XLSX export for applicants
