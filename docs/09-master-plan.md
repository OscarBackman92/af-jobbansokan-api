# Master Plan — The Trust-First Recruitment Platform

## The thesis

Every job board has listings, applications and CV databases. None of them
has **trust as the core primitive**. That is the gap this platform attacks:

- Candidates lie on CVs and employers cannot verify claims
- Employers ghost candidates and nobody is held accountable
- Applicants write the same CV into ten different ATSs they do not control
- Job seekers must *prove* activity to A-kassa with self-attestation
- AI screening is spreading with zero transparency — and the EU AI Act
  classifies recruitment as **high-risk**, demanding exactly the
  auditability this platform was built on from day one

We already have the foundation nobody else starts with: verified identity
(BankID), immutable application events, an append-only audit log, full
disclosure transparency, candidate-owned portable data, and a live feed of
the entire Swedish job market (JobTech). The plan is to grow from
"verifiable evidence registry" into the place where **both sides can
finally trust what they see**.

## Why anyone would switch

| Audience | Today's pain | Our answer |
| --- | --- | --- |
| Candidates | Re-typing CVs, ghosting, no control over data | One verified profile, full market via JobTech, response-rate stats on employers, GDPR-grade control |
| Employers | CV fraud, screening cost, ATS lock-in | BankID-verified candidates, attested work history, free modern ATS |
| A-kassa / authorities | Self-attestation, fraud, manual checks | Signed evidence API (already live) |
| Regulators | Black-box AI hiring | Every decision logged, explainable, exportable |

The cold-start problem is solved by aggregation: we import the whole of
Platsbanken, so candidates get full market coverage on day one — employers
follow the candidates.

## Phases

### Phase 0 — Live and solid (days)

- [x] Production deploy (Render blueprint, bootstrap, hardening)
- [ ] Custom domain + monitoring (Sentry) + uptime checks
- [ ] Scheduled posting imports (Render cron) instead of manual command
- [ ] E2E smoke tests (Playwright) on top of the 78 API tests
- [ ] Accessibility and mobile pass on the frontend

### Phase 1 — Useful every day: search & match

The product people return to daily.

- Full-text search over postings (Postgres FTS) with filters: location,
  source, date, employer
- Skill matching: CV skills vs. posting text — "your profile matches
  7/10 requirements", sortable match score (rule-based first, no AI
  needed to be useful)
- Saved searches and favorites
- Email notifications: new matching postings, status changes
- Larger, scheduled JobTech imports (all categories, daily refresh)

### Phase 2 — Communication & accountability

Where the trust thesis becomes visible product.

- Messaging between employer and candidate (on-platform, logged)
- ATS pipeline for employers: kanban over the existing status workflow,
  team comments, interview scheduling
- Structured rejections with reason codes
- **Public employer accountability**: response rate and median response
  time per employer, computed from data we already audit-log. No other
  platform dares to show this — we can, because measurement is built in

### Phase 3 — The real trust chain

- Real BankID (RP certificate) replacing the mock — the flow, data model
  and 503-gated endpoints are already shaped for it (docs/08)
- Employer verification against Bolagsverket (org number lookup)
- **Attested work history**: employers confirm employment periods,
  producing portable, verified CV entries — the LinkedIn-killer feature:
  claims on profiles stop being claims
- Verified references (signed, revocable, candidate-controlled)

### Phase 4 — Transparent intelligence

AI features, but auditable — our compliance moat under the EU AI Act.

- Semantic matching (embeddings) between CV and postings
- AI-assisted CV improvement and application drafts (candidate-side)
- Screening assistance for employers where **every ranking is explained
  and logged** in the same audit trail as everything else
- Bias monitoring dashboards built on the audit log

### Phase 5 — Ecosystem & scale

- Webhooks + public API program (OpenAPI already published)
- PWA/mobile app
- More authority partners (CSN, Försäkringskassan-style integrations)
- White-label for municipalities and trade unions
- EU expansion: eIDAS identity instead of BankID

## Architecture evolution required

| Concern | Today | Needed from Phase |
| --- | --- | --- |
| Background work | Synchronous | Celery/RQ + Redis (Phase 1: imports, emails) |
| Search | ORM filters | Postgres FTS (Phase 1), embeddings later (Phase 4) |
| Email | None | Transactional provider (Phase 1) |
| Realtime | None | Channels/SSE for messaging (Phase 2) |
| Observability | Logs | Sentry + structured logging + metrics (Phase 0) |
| Legal | Docs drafts | Terms, privacy policy, DPA for partners (Phase 2-3) |

The monolith (Django + DRF + one `core` app) is correct until well into
Phase 2; split apps (`identity`, `postings`, `ats`, `partners`) when the
module boundaries hurt, not before.

## Principles that do not bend

1. **Append-only truth** — evidence and audit rows are never edited
2. **Data minimization** — store the hash, not the number; parse the
   file, never keep it
3. **The candidate owns the profile** — export everything, delete
   everything, see every disclosure
4. **No black boxes** — any algorithm that affects a human is explainable
   and logged
5. **Least privilege** — every consumer sees the minimum, always

## Honest risks

- **Network effects**: aggregation buys reach, but employer-side traction
  is the hard part; the free verified-candidate ATS is the wedge
- **Real BankID** costs money and agreements (bank RP contract)
- **Attested history** needs employer incentives — start with employers
  already on the platform recruiting actively
- **One developer**: phases are sequenced to ship value alone, in order
