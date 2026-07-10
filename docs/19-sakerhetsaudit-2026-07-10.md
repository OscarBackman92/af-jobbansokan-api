# Säkerhetsaudit — juli 2026

Granskning av Jobbsöket i produktion (`https://jobbjungeln.onrender.com`)
mot kod, drift och dokumentation. Ingen penetrationstest eller extern
sårbarhetsscan — statisk genomgång av repot + jämförelse med faktisk
Render/Supabase-setup.

**Status:** Ingen kritisk sårbarhet hittad i kodbasen. Kvarvarande risker
är främst driftkonfiguration, JWT-lagring i webbläsaren och manuella
GDPR-steg utanför repot.

---

## Sammanfattning

| Område | Bedömning |
|--------|-----------|
| Åtkomstkontroll (API) | God — ägarfiltrerade querysets, verifierad e-post krävs |
| Autentisering | God — throttling, JWT-rotation, lösenordsbyte svartlistar refresh |
| Dataminimering (CV) | God — filer lagras inte |
| Transport & headers | God — HSTS, CSP, secure cookies i produktion |
| Beroenden | God — `pip-audit` + `npm audit` i CI (informativt) |
| Drift & hemligheter | Kräver manuell uppföljning (se öppna punkter) |
| Dokumentation | Uppdaterad i samma commit som denna fil |

---

## Vad som fungerar (verifierat i kod + tester)

- **Ägarskap:** `JobApplication`, `SavedJobSearch`, `Resume` filtreras på
  `request.user` i vyer; tester täcker cross-user-åtkomst.
- **E-postverifiering:** `IsAuthenticatedUser` kräver verifierad primär
  adress när `ACCOUNT_EMAIL_VERIFICATION = mandatory`.
- **Rate limiting:** `dj_rest_auth` 5/min, upload 15/h, JobTech 90/min,
  allmän API 30/min anon / 300/min user (`test_security.py`).
- **Lösenordsåterställning:** ingen kontospridning vid okänd e-post
  (`test_auth.py`).
- **CSV-export:** formelinjektion mitigeras (`csv_safety.py`).
- **Produktionshardening:** CSP, `X-Frame-Options`, HSTS, SSL redirect
  när `DEBUG=0`; Swagger kräver staff (`api_docs.py`).
- **CV-uppladdning:** max 2 MB, tillåtna filtyper, parse i minne.
- **GDPR i kod:** kontoradering kaskaderar data; `prune_inactive_accounts`
  med 30 dagars varsel.
- **Produktion utan SQLite:** `DATABASE_URL` krävs när `DJANGO_DEBUG=0`
  (`settings.py` sedan `d3d92c6`).
- **Docker-build:** `collectstatic` körs vid containerstart (inte vid
  build) så `DATABASE_URL` behövs inte i image-bygget (`cfdbda0`).

---

## Findings (prioriterade)

### Medel — accepterad risk / dokumenterad

| ID | Plats | Finding | Åtgärd |
|----|-------|---------|--------|
| M1 | `frontend/src/auth.js`, `settings.py` REST_AUTH | JWT (access + refresh) i **localStorage** — stjäls vid XSS | CSP minskar risk; httpOnly-cookies är framtida förbättring (se `03-security-threat-model.md`) |
| M2 | SPA URL-parametrar | `verify_key`, `reset_uid`/`reset_token` i query string kan läcka via Referer/historik | Dokumenterat; flytta till hash eller POST i framtiden |
| M3 | Render env | **`CONTACT_EMAIL` saknas** → `/.well-known/security.txt` 404, svag kontaktväg i policy | Sätt i Render Environment |
| M4 | `settings.py` | `DEFAULT_FROM_EMAIL` fallback `no-reply@ansokt.app` om env saknas | Sätt `DEFAULT_FROM_EMAIL` med verifierad domän i prod |
| M5 | Sentry | Publik frontend-DSN i `/runtime-config.js` | Konfigurera **Allowed Domains** (deploy-check `core.W003`) |
| M6 | `docs/17`, policy | Registerförteckning sa Render Postgres — faktiskt **Supabase EU** | Uppdaterat i `17-registerforteckning.md` |

### Låg — förbättringar / backlog

| ID | Finding | Åtgärd |
|----|---------|--------|
| L1 | Inga hårda JSON-storleksgränser på CV-fält i DB | Överväg validering i serializer (backlog i `03`) |
| L2 | Google OAuth kod finns men **ej konfigurerat i prod** | Knappen döljs utan `GOOGLE_CLIENT_ID`; dokumentera som valfritt |
| L3 | `pip-audit` i CI är `continue-on-error: true` | Medvetet — granska loggen vid varje release |
| L4 | Render cold start | Tillgänglighet, inte säkerhet — nämn i support/Reddit |

### Ingen åtgärd krävs nu

- Admin på `/admin/` — skyddas av unikt användarnamn + lösenord (check `core.W002`).
- Cron-jobb ärver `DATABASE_URL` från web om blueprint/manuell env är korrekt.
- Uppladdade CV-filer persisteras inte (`ResumeParseView`, modellkommentar).

---

## Manuell checklista (ägare / drift)

Gå igenom efter varje större deploy:

```bash
python backend/manage.py check --deploy
```

Förväntat i produktion (med env satt):

- Inga errors; eventuella **warnings** för e-post, Sentry, admin-namn.
- `curl -sI https://jobbjungeln.onrender.com/ | findstr /i content-security` → CSP finns.
- `curl -s -o NUL -w "%{http_code}" https://jobbjungeln.onrender.com/api/docs/` → `403`.
- `https://jobbjungeln.onrender.com/.well-known/security.txt` → `200` med Contact.
- `https://jobbjungeln.onrender.com/health/` → `{"status":"ok"}` utan `email_not_configured`.

Render Environment (minimum):

| Variabel | Krävs |
|----------|-------|
| `DATABASE_URL` | Ja (Supabase Session pooler, `sslmode=require`) |
| `DJANGO_SECRET_KEY` | Ja |
| `DJANGO_DEBUG` | `0` |
| `FRONTEND_URL` | `https://jobbjungeln.onrender.com` (eller egen domän) |
| `BREVO_API_KEY` + `DEFAULT_FROM_EMAIL` | Ja för mejl |
| `CONTACT_EMAIL` | Ja för integritet + security.txt |
| `DJANGO_SUPERUSER_USERNAME` | Unikt (inte `admin`) |
| `SENTRY_DSN` | Rekommenderat |
| `GOOGLE_CLIENT_ID` | Valfritt (ej aktiv i prod juli 2026) |

Biträdesavtal (DPA): Render, Brevo, Sentry, Google — se
[14-sakerhet-produktion.md](14-sakerhet-produktion.md) §7.

---

## Relaterade dokument (uppdaterade i samband med audit)

| Dokument | Innehåll |
|----------|----------|
| [03-security-threat-model.md](03-security-threat-model.md) | Hotmodell + mitigeringar |
| [06-gdpr-privacy.md](06-gdpr-privacy.md) | GDPR-principer och användarrättigheter |
| [14-sakerhet-produktion.md](14-sakerhet-produktion.md) | Produktionschecklista |
| [16-incidentrutin.md](16-incidentrutin.md) | Personuppgiftsincident |
| [17-registerforteckning.md](17-registerforteckning.md) | Art. 30-register |
| [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md) | Test + cron |

**Nästa granskning:** vid större auth-ändring, ny tredjepartsintegration,
eller före betald/marknadsförd lansering med egen domän.
