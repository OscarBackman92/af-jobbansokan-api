# Security & Threat Model

## Assumptions
- The system handles sensitive personal data (PII)
- Partner access must be strictly authorized and logged

## Top Risks (initial)
1. Unauthorized partner data access
2. Token theft / credential stuffing
3. Event tampering (integrity)
4. Excessive data disclosure (privacy)
5. Insider abuse
6. Replay attacks on event submission
7. Weak audit trail
8. Injection vulnerabilities
9. Misconfiguration (CORS, debug, secrets)
10. Denial of service

## Mitigations (MVP direction)
- Strong auth + role-based permissions
- Rate limiting (later milestone)
- Append-only audit log
- Immutable receipts/hashes for events (later milestone)
- Secrets management via env vars
- Security headers and safe defaults
