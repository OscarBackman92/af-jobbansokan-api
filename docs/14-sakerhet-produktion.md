# Produktionssäkerhet — checklista

Steg för säkerhetsåtgärder 1–6. Kodändringar för 4–6 sker i repot;
1–3 kräver åtgärder i Render och Sentry. GDPR-åtgärder: se punkt 7.

## 1. Betald Postgres i EU (Frankfurt)

**Vad det betyder:** Databasen försvinner inte efter 30 dagar (gratisnivå) och
data lagras i EU enligt GDPR.

**Ny deploy (render.yaml):** `plan: basic-256mb`, `region: frankfurt` (~$6/mån).

**Befintlig deploy på Render (t.ex. Oregon + free):**

1. Render Dashboard → **ansokt-db** → **Upgrade** → Basic 256 MB.
2. Region kan **inte** ändras på befintlig databas. För EU:
   - Skapa ny Postgres i **Frankfurt** (Basic 256 MB).
   - Exportera data: `pg_dump` från gamla → importera till nya.
   - Uppdatera `DATABASE_URL` på webbtjänsten och cron.
   - Ta bort gamla databasen när allt fungerar.
3. Webbtjänst: uppgradera till **Starter** (~$7/mån) och sätt **region:
   Frankfurt** (samma region som databasen = snabbare + privat nät).

## 2. Sentry Allowed Domains

**Vad det betyder:** Den publika frontend-DSN:en i `/runtime-config.js` kan
annars användas för att spamma er Sentry med falska fel.

**Hur:**

1. [sentry.io](https://sentry.io) → ert projekt → **Settings** → **Security**
   → **Allowed Domains**.
2. Lägg till bara er produktionsdomän, t.ex. `ansokt.onrender.com` (och er
   egna domän när den finns).
3. Ta bort `*` om det finns.

Deploy-check `core.W003` påminner om detta när `SENTRY_DSN` är satt.

## 3. Unikt admin-användarnamn

**Vad det betyder:** `/admin/` med användarnamn `admin` är halva
inloggningen gissad.

**Hur:**

1. Render → **ansokt** → **Environment** → sätt
   `DJANGO_SUPERUSER_USERNAME` till något unikt (t.ex. `ansokt-ops-jan`).
2. Sätt `DJANGO_SUPERUSER_EMAIL` till din e-post.
3. Lösenord genereras vid första deploy (`generateValue`) eller sätt manuellt.
4. Om superuser redan skapats med `admin`: skapa ny superuser i Render Shell
   eller lokalt mot prod-DB, radera `admin`.

Deploy-check `core.W002` varnar om användarnamn är `admin`, `root`, m.fl.

## 4. Auth rate limiting (i kod)

**Vad det betyder:** Max **5 försök per minut** per IP på inloggning,
registrering, lösenordsåterställning, e-postverifiering och token refresh.

**Implementerat i:** `ScopedRateThrottle` + scope `dj_rest_auth` i
`settings.py`, throttlade auth-vyer i `core/auth_views.py`.

## 5. Swagger låst i produktion (i kod)

**Vad det betyder:** `/api/docs/` och `/api/schema/` kräver **staff/admin** när
`DEBUG=0`. Utvecklare loggar in via `/admin/` för att se API-dokumentation.

**Implementerat i:** `config/api_docs.py`.

## 6. Content-Security-Policy (i kod)

**Vad det betyder:** Webbläsaren tillåter bara script och anrop från godkända
källor — minskar skadan om någon hittar ett XSS-hål.

**Implementerat i:** `core/middleware.py` (`SecurityHeadersMiddleware`).

Tillåtet: egna scripts, Google Fonts, Sentry. Aktivt när `DEBUG=0`.

## 7. GDPR-pappersarbete (manuella steg utanför repot)

Koden uppfyller sin del (policy i appen, gallringskommando,
incidentrutin i `docs/16`, registerförteckning i `docs/17`).
Kvar att göra som ägare:

1. **Sätt `CONTACT_EMAIL`** i Render (web service) — visas i
   integritetspolicyn och på `/.well-known/security.txt`. Utan den
   saknar policyn kontaktväg.
2. **Acceptera biträdesavtal (DPA):**
   - Render: [render.com/dpa](https://render.com/dpa) (ingår i ToS —
     verifiera versionen).
   - Brevo: DPA finns under Account → Legal i deras dashboard.
   - Sentry: godkänns under Organization Settings → Legal & Compliance.
   - Google Cloud (OAuth): [Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum).
3. **Sentry EU-datalagring:** skapa/flytta projektet till EU-regionen
   (Settings → region visas vid projektskapande) så felrapporter
   stannar i EU.
4. **Incident:** läs `docs/16-incidentrutin.md` en gång nu — inte
   först när det brinner.

## Verifiera efter deploy

```bash
# Deploy-checks (varningar för e-post, Sentry, admin-namn)
python backend/manage.py check --deploy

# CSP-header (ersätt med er URL)
curl -sI https://ansokt.onrender.com/ | findstr /i content-security

# Swagger ska ge 403 utan admin-inloggning
curl -s -o NUL -w "%{http_code}" https://ansokt.onrender.com/api/docs/
```

Förväntat: `403` på `/api/docs/` för anonyma anrop i produktion.
