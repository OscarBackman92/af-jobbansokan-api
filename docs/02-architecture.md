# Architecture

## Overview

- DRF-based API service (Python/Django)
- Postgres database
- OpenAPI via drf-spectacular
- CI via GitHub Actions

## Components

- API (Django/DRF)
- Database (Postgres)
- Auth provider (dj-rest-auth/allauth; BankID planned)
- Audit log (append-only, in `core.AuditLog`)
- Partner integration layer (API key auth; OAuth2/mTLS future)
- Posting import from Arbetsförmedlingen's JobTech Search API
  (`import_postings` management command, upserts on source+external_id)

## Data Flows (High level)

1. Applicant logs in -> obtains access token
2. Applicant submits job application event -> event stored + audit log entry
3. Employer lists applications to own organization -> disclosure logged
4. A-kassa retrieves events per person and period (API key) -> disclosure logged

## Non-functional requirements

- Auditability
- Least privilege access
- GDPR compliance principles
- Strong logging and monitoring
