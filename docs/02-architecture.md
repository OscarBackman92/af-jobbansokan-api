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
- Partner integration layer (future OAuth2/mTLS)

## Data Flows (High level)
1. Applicant logs in -> obtains access token
2. Applicant submits job application event -> event stored + audit log entry
3. A-kassa retrieves events (authorized) -> disclosure logged

## Non-functional requirements
- Auditability
- Least privilege access
- GDPR compliance principles
- Strong logging and monitoring
