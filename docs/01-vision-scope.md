# Vision & Scope

## Problem
Unemployment benefit funds (A-kassa) often rely on self-attestation ("on honor") to verify job seeking activity. Manual verification is costly and enables fraud.

## Vision
Provide a verifiable, auditable, privacy-preserving way to register job application events through Arbetsförmedlingen and enable authorized A-kassa partners to retrieve reliable evidence for eligibility decisions.

## MVP Scope (In)
- Applicant authentication (initially standard auth; BankID integration planned)
- Register job application events (immutable/auditable)
- Applicant can list/filter own events
- Partner API for A-kassa to retrieve events per person and time period (least privilege)
- Audit logging for creation and disclosure
- Export for applicant (CSV/XLSX) - later milestone

## Out of Scope (For now)
- Real BankID/eID production integration
- mTLS in production
- Full admin UI
- Employer-side verification workflows

## Roles
- Applicant (job seeker)
- Arbetsförmedlingen system/admin
- A-kassa partner system

