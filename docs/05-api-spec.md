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

### Applicant

- GET /api/v1/me/
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

### Future

- Partner endpoints for A-kassa (per person and time period, least privilege)
- CSV/XLSX export for applicants
