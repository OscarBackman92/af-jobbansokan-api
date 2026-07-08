# Manuell testguide + cron-jobb på Render

Steg-för-steg för att sätta upp bakgrundsjobben i produktion och verifiera
alla funktioner på dator och telefon. Produktions-URL i exemplen:
**https://jobbjungeln.onrender.com** — byt om du har egen domän.

---

## Del 1 — Cron-jobb på Render

Appen har **tre** cron-jobb i `render.yaml`:

| Cron | Schema (UTC) | Kommando | Syfte |
|------|----------------|----------|--------|
| `ansokt-reminders` | Varje dag 06:00 | `send_reminders` | Dagliga påminnelser |
| `ansokt-prune` | Varje dag 06:15 | `prune_inactive_accounts` | GDPR-gallring (varning + radering) |
| `ansokt-weekly-summary` | Måndagar 07:00 | `send_weekly_summary` | Veckosammanfattning + digest för sparade sökningar |

Render kör **ett kommando per cron** (ingen `sh -c` / `&&`). Prune körs 15 minuter efter
påminnelser.

### A. Ny deploy via Blueprint (enklast om du kan deploya om)

1. Logga in på [render.com](https://render.com).
2. Gå till ditt **Blueprint** (eller **New → Blueprint** om du sätter upp från scratch).
3. Välj GitHub-repot `af-jobbansokan-api` och branch `main`.
4. Render läser `render.yaml` och skapar/uppdaterar tjänster.
5. Efter deploy: **Dashboard → Cron Jobs** — kontrollera att alla tre jobben finns:
   - `ansokt-reminders`
   - `ansokt-prune`
   - `ansokt-weekly-summary`
6. Öppna varje cron → **Environment** — verifiera att dessa finns (ärvs från web):
   - `BREVO_API_KEY` eller `EMAIL_HOST` (mejl måste fungera)
   - `DEFAULT_FROM_EMAIL`
   - `FRONTEND_URL` (t.ex. `https://jobbjungeln.onrender.com`)
   - `DATABASE_URL`, `DJANGO_SECRET_KEY`

### B. Lägg till veckocron manuellt (om du inte vill deploya om hela blueprint)

Om `ansokt-reminders` redan finns men `ansokt-weekly-summary` saknas:

1. **Dashboard → Cron Jobs → New Cron Job**.
2. **Name:** `ansokt-weekly-summary`
3. **Region:** Frankfurt
4. **Schedule:** `0 7 * * 1` (måndagar 07:00 UTC ≈ 08:00 svensk sommartid)
5. **Command:**
   ```bash
   python backend/manage.py send_weekly_summary
   ```
6. **Dockerfile path:** `./Dockerfile` (samma som webbtjänsten)
7. **Environment** — kopiera samma variabler som `ansokt-reminders`:
   - `DJANGO_DEBUG=0`
   - `PYTHONPATH=/app/backend`
   - `DJANGO_SETTINGS_MODULE=config.settings`
   - `DATABASE_URL` (samma som web)
   - `DJANGO_SECRET_KEY` (samma som web)
   - `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL`
8. Spara och kör **Trigger Run** en gång för att testa (se nedan).

### C. Testa cron utan att vänta till måndag

**På Render (rekommenderat efter setup):**

1. Öppna cron-jobbet `ansokt-weekly-summary`.
2. Klicka **Trigger Run** / **Run now**.
3. Öppna **Logs** — du ska se antingen:
   - `Not Monday; skipping` → normalt om det inte är måndag. Kör då via Shell (steg D).
   - `Sent 1, skipped …` eller `Would send to …` om du kör med dry-run via shell.

**Via Render Shell** (om du har betald web-plan med shell):

```bash
cd /app
python backend/manage.py send_weekly_summary --dry-run --force
python backend/manage.py send_weekly_summary --force
```

`--force` kör även när det inte är måndag och ignorerar “redan skickat denna vecka”.

**Lokalt** (mot dev-databas + locmem-mail):

```powershell
cd c:\Users\janos\af-jobbansokan-api
$env:PYTHONPATH="backend"
$env:DJANGO_DEBUG="1"
python backend/manage.py send_weekly_summary --dry-run --force
```

### D. Testa dagliga påminnelser

1. I appen: skapa en ansökan med **Nästa steg** = igår eller idag.
2. På Render: öppna `ansokt-reminders` → **Trigger Run** (eller vänta till 06:00 UTC).
3. Kontrollera inkorgen — ämne: *"Jobbsöket — dags att följa upp"*.

### E. Felsökning cron

| Symptom | Åtgärd |
|---------|--------|
| `E-post är inte konfigurerad` | Sätt `BREVO_API_KEY` på web **och** cron; deploya om cron efter ändring |
| Brevo 401 *unrecognised IP* i Render Logs | Brevo → Security → **Authorized IPs** — lägg till Renders utgående IP, eller **inaktivera IP-restriktion** (bättre på Render) |
| Inga mejl trots “Sent” | Kolla skräppost; verifiera avsändare i Brevo |
| `Not Monday; skipping` | Förväntat — använd `--force` i shell eller vänta till måndag |
| Cron finns inte | Deploya blueprint på nytt, eller använd [claude-chrome-render-cron-prompt.md](claude-chrome-render-cron-prompt.md) |
| Migration saknas | Web deploy kör `migrate` vid start; cron behöver samma DB — deploya web först |

---

## Del 2 — Manuell test på dator

Använd **Chrome** eller **Edge**. Ha DevTools (F12) öppet vid inloggning om något strular.

### Förberedelse

- **Produktion:** https://jobbjungeln.onrender.com
- **Lokalt:** `npm run dev` i `frontend/` + Django på port 8000 (se README)
- Testkonto: använd en riktig e-post du kan läsa (för verifiering och mejl)

### 1. Konto & inloggning

| Steg | Gör så här | Förväntat |
|------|------------|-----------|
| Registrera | Skapa konto med e-post + lösenord | Bekräftelsemejl skickas |
| Verifiera | Klicka länk i mejlet (eller klistra in `verify_key` i appen) | Kan logga in |
| Logga in | E-post + lösenord | Tavlan visas |
| Google (om aktivt) | “Fortsätt med Google” | Inloggning utan lösenord |
| Lösenordsåterställning | “Glömt lösenord?” → mejl → nytt lösenord | Nytt lösenord fungerar; gamla sessioner utloggade |
| Logga ut | Profil → logga ut | Tillbaka till startsidan |

### 2. Tavlan

| Steg | Gör så här | Förväntat |
|------|------------|-----------|
| Ny ansökan | “+ Lägg till” → företag, roll, status | Rad i rätt pipeline-steg |
| Byt status | Välj ny status i listan | Rad flyttas; tidslinje loggar |
| Sök/filter | Skriv i sökfältet | Filtrerar rader |
| Snabbfilter | T.ex. “Följ upp”, “Deadline” | Visar rätt subset |
| Idag-panel | Sätt `Nästa steg` = idag/igår | Panel “Idag & att göra” visas |
| Kalender | “Lägg alla i kalender” / per rad | `.ics`-fil laddas ner |
| Exportera | Exportera CSV | Fil med dina ansökningar |
| Ladda om sidan | F5 | Samma flik som innan (t.ex. Profil) |

### 3. Annonser (Platsbanken)

| Steg | Gör så här | Förväntat |
|------|------------|-----------|
| Sök | Sökord + ev. län/ort/yrke | Träfflista |
| Spara sökning | Spara nuvarande filter | Syns under sparade sökningar |
| Spara annons | “Spara på tavlan” | Ny rad på tavlan |
| Dublett | Spara samma annons igen | Felmeddelande om dublett |
| Matchning | Fyll i CV med kompetenser | Match-score på annonser |

### 4. Profil & CV

| Steg | Gör så här | Förväntat |
|------|------------|-----------|
| Redigera profil | Namn → Spara | “Profilen är sparad” |
| Redigera CV | Öppna redigerare → ändra → Spara | Redigeraren stängs; “CV:t är sparat” |
| Osparade ändringar | Ändra utan att spara | “Osparade ändringar” visas |
| Ladda upp CV | PDF/DOCX/TXT | Formulär förifylls; filen sparas inte |
| Radera konto | Profil → radera (bekräfta) | Utloggad; data borta |

### 5. Integritet & säkerhet

| Steg | Gör så här | Förväntat |
|------|------------|-----------|
| Integritetspolicy | Footer → integritet | Policy med kontakt om `CONTACT_EMAIL` satt |
| security.txt | Öppna `/.well-known/security.txt` | Kontakt-rad eller 404 om ej konfigurerat |
| Health | Öppna `/health/` | `{"status":"ok",...}` |

### 6. Mejl (produktion)

| Mejl | Hur du triggar | Ämnesrad (ungefär) |
|------|----------------|---------------------|
| Verifiering | Registrering | Jobbsöket + verify |
| Återställ lösenord | Glömt lösenord | reset |
| Daglig påminnelse | `next_action_at` ≤ idag + cron | *dags att följa upp* |
| Veckosammanfattning | Måndag + aktivitet på tavlan / sparad sökning | *din veckosammanfattning* |
| Inaktivitet (24 mån) | Sällsynt — cron gallring | *raderas om 30 dagar* |

För veckomejl: ha minst en ansökan med aktivitet förra veckan eller `next_action_at` denna vecka, eller sparad sökning med nya annonser — annars skickas inget mejl.

---

## Del 3 — Manuell test på telefon

Samma URL som på dator. Testa i **Safari** (iPhone) och **Chrome** (Android).

### Layout & navigation

1. Öppna https://jobbjungeln.onrender.com i mobilwebbläsaren.
2. Logga in med samma konto.
3. Kontrollera:
   - Navigeringen (Tavla, Annonser, Profil) går att trycka utan att träffa fel knapp.
   - Inget viktigt klipps av i sidled (scrolla om det behövs).
   - Text är läsbar utan zoom.

### Kritiska flöden på mobil

| Flöde | Vad du testar |
|-------|----------------|
| Spara annons | Annonser → sök → spara → Tavla visar raden |
| Uppdatera status | Tavla → öppna rad → ändra status |
| Nästa steg | Sätt datum i ansökningsmodalen |
| CV | Profil → redigera CV → spara (redigeraren stängs) |
| Flik-persistens | Gå till Profil → ladda om sidan → fortfarande Profil |
| Kalender | Idag-panel → Kalender → öppna `.ics` (iOS: “Lägg till i kalender”) |
| Mejl-länkar | Öppna verifierings-/återställningslänk **i telefonen** — ska landa i appen |

### iPhone-specifikt

- Lägg till på hemskärmen (Dela → “Lägg till på hemskärmen”) — känns som en app, ingen App Store behövs.
- Testa både porträtt och landskap.

### Android-specifikt

- “Lägg till på startskärmen” via Chrome-menyn.
- Kontrollera att tangentbordet inte döljer Spara-knappen i formulär.

---

## Del 4 — Snabb checklista (skriv ut)

```
[ ] Cron ansokt-reminders finns och har BREVO/EMAIL + FRONTEND_URL
[ ] Cron ansokt-prune finns (GDPR) + Trigger Run testad
[ ] Cron ansokt-weekly-summary finns + Trigger Run testad
[ ] Registrering + verifieringsmejl
[ ] Inloggning + utloggning
[ ] Lägg till / flytta ansökan på tavlan
[ ] Sök Platsbanken + spara annons
[ ] CV spara (redigeraren stängs)
[ ] Flik kvar efter omladdning
[ ] CSV-export
[ ] Integritetspolicy i footer
[ ] Mobil: samma flöden utan layoutproblem
[ ] Påminnelsemejl (sätt nästa steg igår → kör cron)
[ ] Veckomejl (--force i shell eller vänta till måndag)
```

---

## Relaterad dokumentation

- [claude-chrome-testprompt.md](claude-chrome-testprompt.md) — prompt för Claude in Chrome QA testing
- [claude-chrome-verification-email-prompt.md](claude-chrome-verification-email-prompt.md) — prompt för att testa verifieringsmejl
- [claude-chrome-fix-email-prompt.md](claude-chrome-fix-email-prompt.md) — prompt för att felsöka/fixa Brevo + Render (dela aldrig API-nycklar i chatten)
- [14-sakerhet-produktion.md](14-sakerhet-produktion.md) — env-vars, Sentry, DPA
- [13-lanseringsplan.md](13-lanseringsplan.md) — lansering och retention
- [README.md](../README.md) — lokal utveckling
