# Claude in Chrome — skapa cron-jobb på Render (Jobbsöket)

Kopiera hela prompten i rutan **“Kopiera prompten”** nedan och klistra in i
Claude in Chrome med [dashboard.render.com](https://dashboard.render.com) öppet.

## Innan du startar

1. Webbtjänsten **ansokt** ska redan köra och vara grön (Supabase `DATABASE_URL` satt).
2. Mejl ska fungera (`BREVO_API_KEY` + `DEFAULT_FROM_EMAIL` på web).
3. Dela **aldrig** API-nycklar eller `DATABASE_URL` i chatten — Claude ska be dig
   klistra in dem direkt i Render.
4. Utan dessa cron-jobb skickas **inga påminnelser**, **ingen veckosammanfattning**
   och **ingen GDPR-gallring** av inaktiva konton.

---

## Kopiera prompten

```
Du hjälper mig skapa och verifiera Render cron-jobb för Jobbsöket (Django-appen **ansokt**, region Frankfurt, databas Supabase via DATABASE_URL på web).

## Regler
- Be mig ALDRIG klistra in BREVO_API_KEY, DATABASE_URL, DJANGO_SECRET_KEY eller lösenord i chatten.
- Säg var jag ska klistra in värden (Render Environment) och be mig bekräfta med ja/nej.
- Efter varje steg: ✅ KLART, ⚠️ DELVIS eller ❌ BLOCKERAT.
- Avsluta med checklista + hur jag testar med Trigger Run.

## Bakgrund
Repot `af-jobbansokan-api` definierar två cron-jobb i render.yaml. De syns INTE i Render Dashboard ännu. Webbtjänsten **ansokt** finns och fungerar.

| Cron | Schema (UTC) | Kommando | Syfte |
|------|----------------|----------|--------|
| ansokt-reminders | 0 6 * * * (dagligen 06:00) | send_reminders + prune_inactive_accounts | Påminnelser + GDPR-gallring |
| ansokt-weekly-summary | 0 7 * * 1 (måndag 07:00) | send_weekly_summary | Veckosammanfattning |

---

# DEL 1 — Kontrollera nuläge

1. Render Dashboard → **Cron Jobs** — listan ska vara tom eller sakna dessa två namn.
2. Render → **ansokt** (web) → **Environment** — bekräfta att dessa finns (ja/nej, utan att visa värden):
   - DATABASE_URL (Supabase)
   - DJANGO_SECRET_KEY
   - BREVO_API_KEY (eller EMAIL_HOST)
   - DEFAULT_FROM_EMAIL
   - FRONTEND_URL (t.ex. https://ansokt.onrender.com)
3. Notera om Blueprint finns under **Blueprints** (för alternativ sync i DEL 2A).

---

# DEL 2 — Skapa cron-jobb

## 2A — Försök Blueprint sync först (om tillgängligt)

1. Dashboard → **Blueprints** → välj blueprint kopplad till `af-jobbansokan-api`.
2. **Manual Sync** / **Sync** mot branch `main`.
3. Kontrollera om **ansokt-reminders** och **ansokt-weekly-summary** skapas under Cron Jobs.
4. Om båda finns → hoppa till DEL 3. Om inte → DEL 2B.

## 2B — Skapa manuellt: ansokt-reminders

Render → **Cron Jobs** → **New Cron Job**:

| Fält | Värde |
|------|--------|
| Name | `ansokt-reminders` |
| Region | Frankfurt |
| Repository | `af-jobbansokan-api` (samma som web) |
| Branch | `main` |
| Runtime | Docker |
| Dockerfile path | `./Dockerfile` |
| Schedule | `0 6 * * *` |
| Command | `sh -c "python backend/manage.py send_reminders && python backend/manage.py prune_inactive_accounts"` |

**Environment variables** — sätt samma som webbtjänsten ansokt (kopiera/länka, visa inte i chat):

| Variabel | Värde |
|----------|--------|
| DJANGO_DEBUG | `0` |
| PYTHONPATH | `/app/backend` |
| DJANGO_SETTINGS_MODULE | `config.settings` |
| DATABASE_URL | *(samma som web — Supabase)* |
| DJANGO_SECRET_KEY | *(samma som web)* |
| BREVO_API_KEY | *(samma som web)* |
| DEFAULT_FROM_EMAIL | *(samma som web)* |
| FRONTEND_URL | *(samma som web)* |
| EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS, EMAIL_USE_SSL, EMAIL_TIMEOUT | *(samma som web, om satta)* |
| SENTRY_DSN | *(valfritt, samma som web)* |
| SENTRY_ENVIRONMENT | `production` |

Spara och vänta tills första builden är grön.

## 2C — Skapa manuellt: ansokt-weekly-summary

**New Cron Job** igen:

| Fält | Värde |
|------|--------|
| Name | `ansokt-weekly-summary` |
| Region | Frankfurt |
| Repository / Branch | samma som ovan |
| Dockerfile path | `./Dockerfile` |
| Schedule | `0 7 * * 1` |
| Command | `python backend/manage.py send_weekly_summary` |

**Environment:** samma uppsättning som `ansokt-reminders` (minst DATABASE_URL, DJANGO_SECRET_KEY, BREVO_API_KEY, DEFAULT_FROM_EMAIL, FRONTEND_URL).

---

# DEL 3 — Verifiera miljö

För **båda** cron-jobb:

1. Öppna jobbet → **Environment**.
2. Bekräfta att DATABASE_URL pekar på Supabase (host innehåller `supabase`, inte `dpg-` Render).
3. Bekräfta att BREVO_API_KEY är satt om mejl ska fungera.

---

# DEL 4 — Testkörning (Trigger Run)

## ansokt-reminders

1. Öppna **ansokt-reminders** → **Trigger Run** / **Run now**.
2. Läs **Logs**. Förväntat:
   - Inga databasfel (Supabase-anslutning OK)
   - `send_reminders` kördes (kan vara "Sent 0" om inga deadlines idag — OK)
   - `prune_inactive_accounts` kördes utan fel
3. Om `E-post är inte konfigurerad` → BREVO_API_KEY saknas på cron; kopiera från web.

**Valfritt funktionstest:** I appen, sätt en ansöknings **Nästa steg** till idag → Trigger Run igen → kolla inkorg (*"Jobbsöket — dags att följa upp"*).

## ansokt-weekly-summary

1. **Trigger Run** på `ansokt-weekly-summary`.
2. Logs:
   - Om **inte måndag:** kan stå `Not Monday; skipping` — det är normalt.
   - På måndag eller med force: `Sent …` eller liknande.
3. Förklara att full test på icke-måndag kräver Render Shell:
   `python backend/manage.py send_weekly_summary --force`
   (endast om web-plan har Shell).

---

# DEL 5 — Felsökning

| Symptom | Åtgärd |
|---------|--------|
| Build fail på cron | Jämför Dockerfile path och branch med web |
| DB connection error | DATABASE_URL på cron måste matcha web (Supabase Session pooler) |
| Brevo 401 unrecognised IP | Brevo → Security → Authorized IPs — lägg till Renders IP eller inaktivera IP-filter |
| Cron körs men inget mejl | Skräppost; verifiera DEFAULT_FROM_EMAIL i Brevo |
| Not Monday; skipping | Förväntat för weekly — vänta till måndag eller --force i shell |

---

## Rapportformat

### Sammanfattning
- Vilka cron skapades (namn + status)
- Blueprint sync eller manuellt
- Resultat av Trigger Run (kort)

### Kvar att göra
- [ ] …

### Drift
- Daglig påminnelse: ~07:00 svensk tid (06:00 UTC)
- Veckosammanfattning: måndag ~08:00 svensk sommartid (07:00 UTC)
- GDPR-gallring: körs dagligen i ansokt-reminders
```

---

## Efter setup

- Cron behöver **inte** uppdateras vid vanliga kod-deploys — de bygger om från samma repo vid ändringar i `Dockerfile` eller om du triggar deploy på cron.
- Om du roterar Supabase-lösenord: uppdatera bara `DATABASE_URL` på **web**; kopiera sedan till cron om de inte är länkade.
- Mer detaljer: [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md).
