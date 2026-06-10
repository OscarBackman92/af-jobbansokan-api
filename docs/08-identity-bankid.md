# Identity & BankID

## The problem

The whole vision rests on a trust chain: an A-kassa must know that the
events it retrieves belong to a specific *person*, not just to a username.
Two gaps in the original MVP:

1. Accounts were self-registered with username/password — nothing ties an
   account to a real identity.
2. The partner API identified people by internal user id, but an A-kassa
   only knows its members by personal identity number (personnummer).

## Design goals

- Tie each applicant account to a **verified identity** (BankID)
- Let partners query by **personnummer** — the identifier they actually have
- **Never store the personnummer in clear.** It is classified as a direct
  identifier (see [04-data-model.md](04-data-model.md)); we keep only a
  keyed hash

## Pseudonymization

`ApplicantProfile.personal_number_hash = HMAC-SHA256(personnummer, key=PERSON_HASH_KEY)`

- The 12-digit form (`YYYYMMDDNNNN`) is normalized before hashing
- A **keyed** hash (HMAC) is used instead of a plain digest: the
  personnummer key space is small (~10^4 per birth date), so an unkeyed
  hash could be brute-forced trivially. Without `PERSON_HASH_KEY` the
  hashes are useless to an attacker
- `PERSON_HASH_KEY` must be stable across deploys (rotating it orphans all
  identities) and managed as a secret in production; it defaults to
  `SECRET_KEY` for development
- Partner lookups compute the same HMAC and match on the hash — the raw
  number is never persisted or written to the audit log

## Authentication flow (mimics the BankID RP API)

```text
Client                          API                          BankID (mocked)
  |  POST /auth/bankid/initiate/ |                                 |
  |  {personal_number}           |                                 |
  |----------------------------->|  (real: POST /rp/v6.0/auth)     |
  |  {order_ref, status=pending} |                                 |
  |<-----------------------------|                                 |
  |  POST /auth/bankid/collect/  |                                 |
  |  {order_ref}                 |  (real: poll /rp/v6.0/collect)  |
  |----------------------------->|                                 |
  |  {status=complete,           |                                 |
  |   access, refresh, user_id}  |                                 |
  |<-----------------------------|                                 |
```

On `collect`, the API:

1. Verifies the order (mock: a signed, time-limited token; real: BankID's
   `completionData` signature)
2. Computes the personnummer hash and finds or creates the user +
   `ApplicantProfile` (created accounts have no usable password — BankID
   is their only login path)
3. Writes an `identity.verified` audit entry (hash only, never the number)
4. Issues a standard JWT pair — everything downstream is unchanged

## Mock vs production

| Aspect | Mock (this repo) | Production |
| --- | --- | --- |
| Trigger | `BANKID_MOCK=1` env var | Real BankID RP API v6 with client TLS cert |
| Order | Signed token containing the pnr, 5 min TTL | `orderRef` from BankID, polled status |
| Verification | None — anyone with a pnr "is" that person | BankID app signature, `completionData` validation |
| Launch | Skipped | `autoStartToken`/QR code to the BankID app |

The mock endpoints return **503** when `BANKID_MOCK` is off, so they can
never silently act as a backdoor in a real deployment. The mock exists to
prove the data flows end to end: verified identity → pseudonym → partner
lookup → audit trail.

## Production checklist (future)

- [ ] BankID RP certificate management
- [ ] Verify `completionData` signature and cert chain on collect
- [ ] Replay protection on orderRef (single-use)
- [ ] Rate limiting on initiate/collect
- [ ] `PERSON_HASH_KEY` in a secret manager, separate from `SECRET_KEY`
- [ ] Decide retention: unlink/delete `ApplicantProfile` on account deletion
