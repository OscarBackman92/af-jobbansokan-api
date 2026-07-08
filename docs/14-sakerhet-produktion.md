# Produktionssäkerhet — checklista

Steg för säkerhetsåtgärder 1–6. Kodändringar för 4–6 sker i repot;
1–3 kräver åtgärder i Render och Sentry. GDPR-åtgärder: se punkt 7.

## 1. Postgres i EU (Supabase)

**Vad det betyder:** Användardata lagras i EU (GDPR). Supabase hanterar
backuper och SQL-konsol; Django på Render ansluter via `DATABASE_URL`.

**Ny deploy:**

1. Skapa Supabase-projekt i **EU** (t.ex. Frankfurt / `eu-central-1`).
2. Kopiera **Session pooler** connection string (port **5432**, inte Transaction 6543).
3. Sätt `DATABASE_URL` på Render-webbtjänsten **jobbjungeln** (cron ärver värdet om blueprint länkar dem).
4. Migrera data från gammal databas om du byter leverantör — se
   [claude-chrome-supabase-prompt.md](claude-chrome-supabase-prompt.md).

**Befintlig deploy med Render Postgres:**

1. Exportera med `pg_dump`, importera till Supabase med `pg_restore`.
2. Uppdatera `DATABASE_URL` på web + verifiera cron.
3. Ta bort Render Postgres när allt fungerar (sparar ~$6/mån).

Webbtjänst: **Starter** i **Frankfurt** (samma region som Supabase EU = lägre latency).

## 2. Sentry Allowed Domains

**Vad det betyder:** Den publika frontend-DSN:en i `/runtime-config.js` kan
annars användas för att spamma er Sentry med falska fel.

**Hur:**

1. [sentry.io](https://sentry.io) → ert projekt → **Settings** → **Security**
   → **Allowed Domains**.
2. Lägg till bara er produktionsdomän, t.ex. `jobbjungeln.onrender.com` (och er
   egna domän när den finns).
3. Ta bort `*` om det finns.

Deploy-check `core.W003` påminner om detta när `SENTRY_DSN` är satt.

## 3. Unikt admin-användarnamn

**Vad det betyder:** `/admin/` med användarnamn `admin` är halva
inloggningen gissad.

**Hur:**

1. Render → **jobbjungeln** → **Environment** → sätt
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

## 8. Brevo — auktoriserade IP-adresser (Render)

Om registrering ger *"Vi kunde inte skicka verifieringsmejlet"* men
`BREVO_API_KEY` är satt, kolla Render Logs för `401` och texten
*unrecognised IP address*.

**Orsak:** Brevo → Security → **Authorized IPs** blockerar Renders
utgående IP (ändras vid omdeploy på free/starter).

**Åtgärd (välj en):**

1. **Rekommenderat för Render:** Inaktivera IP-restriktion i Brevo
   (API-nyckeln är hemligheten; IP-lås är opraktiskt med dynamisk hosting).
2. **Alternativ:** Lägg till Renders aktuella utgående IP i listan efter
   varje omdeploy (fragilt).

Efter kod-deploy flaggar `/health/` ogiltig Brevo-nyckel; IP-block syns
fortfarande först vid faktiskt utskick — testa med
`python backend/manage.py send_test_email dig@epost.se` i Render Shell.

## Verifiera efter deploy

```bash
# Deploy-checks (varningar för e-post, Sentry, admin-namn)
python backend/manage.py check --deploy

# CSP-header (ersätt med er URL)
curl -sI https://jobbjungeln.onrender.com/ | findstr /i content-security

# Swagger ska ge 403 utan admin-inloggning
curl -s -o NUL -w "%{http_code}" https://jobbjungeln.onrender.com/api/docs/
```

Förväntat: `403` på `/api/docs/` för anonyma anrop i produktion.
