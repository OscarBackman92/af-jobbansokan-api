# API Spec (Draft)

## Conventions
- Base path: /api/v1/
- JSON by default
- Pagination for list endpoints
- Idempotency keys for write endpoints (future)

## MVP endpoints (draft)
- GET /health/
- Auth endpoints (dj-rest-auth)
- POST /api/v1/application-events/
- GET /api/v1/application-events/?from=&to=
- Partner endpoints (future milestone)
