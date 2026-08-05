# Manuell testguide

Steg-för-steg för att verifiera alla funktioner på dator och telefon.
Produktions-URL i exemplen: **https://jobbjungeln.onrender.com** — byt om
du har egen domän.

Management-kommandona `send_reminders`, `prune_inactive_accounts` och
`send_weekly_summary` finns kvar och kan köras **manuellt** när du behöver
testa mejl eller gallring. De är **inte** schemalagda i produktion (inga
Render cron-jobb).

**Lokalt** (mot dev-databas + locmem-mail):

```powershell
cd c:\Users\janos\af-jobbansokan-api
$env:PYTHONPATH="backend"
$env:DJANGO_DEBUG="1"
python backend/manage.py send_reminders --dry-run
python backend/manage.py send_weekly_summary --dry-run --force
python backend/manage.py prune_inactive_accounts --dry-run
```

`--force` på veckosammanfattningen kör även när det inte är måndag och
ignorerar “redan skickat denna vecka”.

---

## Del 1 — Manuell test på dator

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
| Daglig påminnelse | `next_action_at` ≤ idag + kör `send_reminders` manuellt om du testar e-post | *dags att följa upp* |
| Veckosammanfattning | Kör `send_weekly_summary --force` manuellt om du testar e-post | *din veckosammanfattning* |
| Inaktivitet (24 mån) | Sällsynt — kör `prune_inactive_accounts` manuellt om du testar | *raderas om 30 dagar* |

För veckomejl: ha minst en ansökan med aktivitet förra veckan eller `next_action_at` denna vecka, eller sparad sökning med nya annonser — annars skickas inget mejl.

---

## Del 2 — Manuell test på telefon

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

## Del 3 — Snabb checklista (skriv ut)

```
[ ] Registrering + verifieringsmejl
[ ] Inloggning + utloggning
[ ] Lägg till / flytta ansökan på tavlan
[ ] Sök Platsbanken + spara annons
[ ] CV spara (redigeraren stängs)
[ ] Flik kvar efter omladdning
[ ] CSV-export
[ ] Integritetspolicy i footer
[ ] Mobil: samma flöden utan layoutproblem
[ ] (Valfritt) Påminnelsemejl — kör send_reminders manuellt om du testar e-post
[ ] (Valfritt) Veckomejl — kör send_weekly_summary --force manuellt om du testar e-post
```

---

## Relaterad dokumentation

- [claude-chrome-testprompt.md](claude-chrome-testprompt.md) — prompt för Claude in Chrome QA testing
- [claude-chrome-verification-email-prompt.md](claude-chrome-verification-email-prompt.md) — prompt för att testa verifieringsmejl
- [claude-chrome-fix-email-prompt.md](claude-chrome-fix-email-prompt.md) — prompt för att felsöka/fixa Brevo + Render (dela aldrig API-nycklar i chatten)
- [14-sakerhet-produktion.md](14-sakerhet-produktion.md) — env-vars, Sentry, DPA
- [13-lanseringsplan.md](13-lanseringsplan.md) — lansering och retention
- [README.md](../README.md) — lokal utveckling
