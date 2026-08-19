# Prompt: bygg Jobbdjungeln från grunden

Kopiera **hela** rutan under **“Kopiera prompten”** till Claude, Cursor eller
liknande. Prompten beskriver produkten **Jobbdjungeln** så att en agent kan
återskapa motsvarande webbapp med alla viktiga funktioner.

Referensproduktion (om du får titta): https://jobbjungeln.onrender.com  
(SPA under `/app/`, marketing på `/`.)

---

## Kopiera prompten

```
Du ska bygga en komplett svensk webbapp: **Jobbdjungeln**.

## Produkt
Jobbdjungeln är en personlig jobbsökningstavla för personer som söker jobb i Sverige.
Den ersätter Excel-arket: statuspipeline för ansökningar, tidslinje per ansökan,
live-sök i Arbetsförmedlingens Platsbanken, CV↔annons-matchning, CSV/ICS-export
och mejl för uppföljning. Användaren äger sin data. Inga annonser. Ingen
rekryteringssida, ingen BankID, ingen arbetsgivarring.

Tagline: **Koll på hela ditt jobbsök.**
Språk i UI: **svenska** överallt.
Varumärke: **Jobbdjungeln** (inte Jobbsöket/Ansökt).

Syfte som ska synas i produkten:
- Hålla många parallella ansökningsprocesser i ordning
- Underlätta **AF-aktivitetsrapportering** (filtrera på ansökningsmånad / sparad
  månad, exportera CSV med svenska statusetiketter och datum)
- Söka Platsbanken utan att lämna appen
- Matcha CV-kompetenser mot annonstext på ett begripligt sätt

---

## Tech stack (håll dig nära detta)
- Backend: Django 5.2 + Django REST Framework, OpenAPI (drf-spectacular), admin (t.ex. django-unfold)
- Auth: e-post + lösenord (dj-rest-auth / allauth), JWT (access ~15 min, refresh ~7 dagar med rotation + blacklist), valfri Google OAuth
- DB: SQLite lokalt, PostgreSQL i produktion (DATABASE_URL, gärna Supabase EU)
- Frontend: React 19 + Vite SPA under `/app/`, TypeScript-typer från OpenAPI om möjligt
- Jobannonser: live mot JobTech JobSearch API (https://jobsearch.api.jobtechdev.se) — gratis, ingen API-nyckel
- E-post: Brevo HTTP API (eller SMTP), console-backend i utveckling
- Deploy: en Docker-image som bygger frontend, WhiteNoise för static/SPA, gunicorn på `0.0.0.0:$PORT` (Render)
- Kvalitet: pytest, ruff/black, frontend-tester, CI

---

## Informationsarkitektur

### Offentliga sidor (serverrenderade marketing)
- `/` — landningssida med varumärke Jobbdjungeln, värdeprop, CTA Skapa konto / Logga in → `/app/`
- `/integritet/` — integritetspolicy
- `robots.txt`, `sitemap.xml`
- `/.well-known/security.txt` när CONTACT_EMAIL är satt (RFC 9116)

### SPA (inloggad) — tre flikar
1. **Ansökningar** (board)
2. **Annonser** (Platsbanken)
3. **Profil & CV**

Flik sparas i URL (`?tab=`) och localStorage. Tema i footer.

### Teman
`system` | `command` (mörk) | `daylight` (ljus, default) | `signal` — sparas i localStorage.

---

## Auth & konto
- Registrering med e-post + lösenord → **obligatorisk e-postverifiering** innan JWT/login
- Inloggning, utloggning
- Glömt lösenord → mejl → SPA med `?reset_uid=&reset_token=`
- Verifieringslänk `?verify_key=`
- Visa/dölj lösenord, begripliga svenska fel (läck inte om e-post finns)
- Transparent JWT-refresh vid 401 så sessionen inte dör mitt i redigering
- Lagra tokens i **sessionStorage** (flik-scopad) tills HttpOnly-cookie finns
- Profil: förnamn, efternamn, e-post; publikt **operator_id** (t.ex. ANS-…)
- **Radera konto permanent** (GDPR) — separat från Spara/Avbryt, tydlig bekräftelse
- Lösenordsbyte invaliderar alla refresh-tokens
- Valfri “Fortsätt med Google” om client id är konfigurerat
- Rate-limit auth-endpoints

---

## Statuspipeline (exakta svenska etiketter)

Aktiva kolumner (tomma göms om inte filtrerade):
| API-id | Etikett |
|--------|---------|
| wishlist | Sparad |
| applied | Ansökt |
| screening | Telefonintervju |
| interview | Intervju |
| forwarded | Skickad vidare |
| offer | Erbjudande |

Avslutade (arkiv):
| API-id | Etikett |
|--------|---------|
| accepted | Accepterat |
| rejected | Avslag |
| no_response | Inget svar |
| withdrawn | Återkallad |

Default vid manuell skapning: **Ansökt**. Vid spara från Platsbanken: **Sparad**.

---

## Flik: Ansökningar

### Översikt
- Hero “Din översikt”
- Klickbara KPI-rutor:
  - **Pågående** — ej avslutade
  - **Följ upp** — behöver uppföljning
  - **Deadline** — Sparad med sista dag inom 7 dagar (KPI exkluderar försenade; Idag visar dem)
  - **Intervjuspår** — Telefonintervju / Intervju / Skickad vidare
  - **Erbjudande** — Erbjudande / Accepterat
- Tom tavla: välkomstguide + CTA till CV / Annonser / ny ansökan

### Idag & att göra
Visa när det finns att göra. Två grupper:
1. **Väntar på svar** — försenat/idag nästa steg; tystnad ≥7 dagar på Ansökt/Telefonintervju; kommande nästa steg ≤7 dagar
2. **Sök innan sista dag** — Sparad med deadline ≤7 dagar (inkl. försenade)

Badges/anledningar på svenska. Per rad och per grupp: ladda ner **.ics**-kalenderfil.
Öppna rad → ansökningsmodal.

### Lista / pipeline
- Sektion “Mina ansökningar”
- **Exportera CSV** (`ansokningar.csv`, UTF-8 BOM) med kolumner:
  id, company, title, location, status (svensk etikett), applied_at, deadline,
  contact_name, contact_info, next_action_at, ad_url, notes
- **+ Ny ansökan**
- Fritextsök (diakritikkänslig fold): företag, roll, ort, anteckning, kontakt, källa
- **Månadsfilter** (AF):
  - Ansökningsmånad = `applied_at` → “Ansökt: mars 2026”
  - Sparad månad = `created_at` → “Sparad: …”
  - Optgroups i select; sammanfattning “Visar X av Y · månad: …”
- Snabbfilter (AND): Alla · Passar mitt CV · Att följa upp · Deadline snart ·
  Intervjuer · Erbjudanden · Avslutade
- Statusfilter via pipeline-rubrik
- Rensa filter nollställer allt
- Sortering: nyast `applied_at` först, utan datum sist
- Kort: titel, meta, match-score om CV finns, deadline-badge (Sparad), nästa-steg-badge
- Statusbyte via select → modal **Byt status** med datum → bekräfta → toast **Ångra** (~8 s)
- Visa max ~25 per stage, sedan “Visa alla”
- Statistik: staplar senaste 6 månaderna (sökt datum); klick filtrerar ansökningsmånad

### Ansökningsmodal
Fält: Företag*, Roll*, Ort, Status, Källa (LinkedIn / Platsbanken / Företagets sida /
Rekryterare / Annat), Sökt datum, Sista ansökningsdag, Nästa steg, Anteckningar,
Kontaktperson, Kontaktuppgift, länkar (ansökan / Platsbanken), annonstext-snapshot.
- Logga samtal → tidslinje
- Tidslinje: manuella händelser + automatiska statusbyten (med valt datum)
- Dubblettskydd: samma annons-URL blockerar; samma företag+roll varnar/blockerar
- Osparade ändringar: bekräftelsedialog innan stäng
- Ta bort ansökan med bekräftelse
- Externa länkar: Ansök hos arbetsgivaren / Öppna annons / Platsbanken

---

## Flik: Annonser (Platsbanken)
- Live-sök mot JobTech via backend (auth + throttle)
- Filter: sökord, län→kommuner (multi), yrkesområde→yrken (multi), Endast distans,
  Passar mitt CV
- Resultatlista med match-score, sista ansökningsdag, Distans-badge
- **+ Spara** → skapar ansökan som **Sparad** med snapshot; knappen blir Sparad ✓
- Detaljmodal med beskrivning **inuti** modalkortet (scroll inuti kortet, inte utanför)
- Deduplicera annonser med samma id i API-svar
- Pagination (t.ex. 25) + `?tab=postings&page=`
- **Sparade sökningar**: spara/byt namn/ta bort filter; klick kör om sökningen
- CV-match: filtrera före paginering när “Passar mitt CV” är på; tomtillstånd med
  CTA “Justera kompetenser” / “Stäng CV-filter”
- Matchning ska vara förklarbar (träffade termer / saknas), boundary-aware
  (t.ex. “Go” matchar inte “Django”)
- Cache identiska JobTech-frågor kort tid server-side (~3 min)

---

## Flik: Profil & CV
- Redigera namn, visa e-post och operator_id
- **Mitt CV**:
  - Ladda upp PDF/DOCX/TXT → parse **i minnet**, filen **sparas aldrig**
  - Redigera rubrik, sammanfattning, erfarenhet, utbildning
  - Kompetenser / evidence: markera förslag, kategorier (Verktyg & teknik /
    Metod & domän / Språk), manuell tillägg, “Markera alla från denna roll”
  - Upp till **3 jobbprofiler** med aktiv profil
  - Leave-guard vid osparade ändringar / flikbyte
  - Radera CV (separat destruktiv zon)
- Matchning på tavlan/annonser använder bekräftade kompetenser från aktiv profil
- Deep-link fokus kompetenser från andra flikar

---

## Integritet & säkerhet
- Integritetspolicy: personuppgiftsansvarig, vad som lagras/inte, processors
  (Render, Brevo, ev. Sentry/Google), retention, rättigheter, IMY
- CSV = dataportabilitet; radera konto = radering
- Retention (management-kommando): inaktiv 24 mån → varningsmejl → radera efter 30 dagar
- Inga tracking-cookies / analytics som standard
- Produktion: DEBUG=0, HSTS, secure cookies, SSL bakom proxy
- DRF: endast JSON-renderer i produktion (ingen browsable API)
- security.txt när CONTACT_EMAIL finns

---

## Backend-API (konceptuellt under /api/v1/)
- `me/` GET/PATCH/DELETE
- `me/resume/` + parse + suggest-evidence/skills
- `me/saved-searches/`
- `applications/` CRUD + events + export + tracked-urls
  (filter: status, search, from/to applied_at)
- `jobs/` search + filters + groups + municipalities + detail
- `/health/`, `/runtime-config.js`, `/api/docs/`, `/admin/`, `/dj-rest-auth/*`

Throttles ungefär: anon 30/min, user 300/min, upload 15/h, jobtech 90/min.

---

## Management-kommandon (finns i kod, körs manuellt / externt schema)
- `bootstrap` — Site-domän från FRONTEND_URL + superuser från env (ingen shell på Free)
- `send_reminders` — mejl när next_action_at ≤ idag
- `send_weekly_summary` — veckosammanfattning (+ sparade sökningar)
- `prune_inactive_accounts` — gallring enligt retention
- `send_test_email` — ops-smoke

**Inget inbyggt schema i webbprocessen.** Dokumentera Free-begränsningar om
Render Free används (sömnlöshet efter 15 min, kallstart, ingen disk/shell).

---

## Domänmodell (produktnivå)
- JobApplication: company, title, location, status, applied_at, deadline,
  next_action_at, contact_*, notes, source, ad_url, apply_url, ad_description,
  source_job_id, timestamps
- ApplicationEvent: occurred_at, note, optional status
- Resume: headline, summary, skills/groups, experience, education, job_profiles
- SavedJobSearch: label + filterfält + match_cv
- OperatorProfile: operator_id, deletion_warned_at, weekly_summary_sent_at

---

## UX-krav som måste finnas
1. Osparade ändringar — dialog i modal och CV
2. Statusbyte med valbart datum + Ångra-toast
3. Idag-panel med två grupper
4. Månadsfilter + klickbara statistikstaplar + CSV för AF
5. Tomma stages göms; empty states för CV-filter med CTA
6. Annonsmodal scrollar inuti kortet
7. Radera konto/CV inte bredvid Spara
8. Diakritikfold i sök
9. Transparent token-refresh
10. Förklarbar CV-match
11. Tema-väljare i footer
12. Svenska copy utan trasiga engelska strängar

---

## Icke-funktionellt
- EU-data (t.ex. Frankfurt + Supabase EU)
- CV-filer lagras aldrig
- Användaren kan exportera och radera
- Bind HTTP till 0.0.0.0:$PORT
- Ephemeral filesystem — state i DB

---

## Leveransordning (bygg i denna ordning)
1. Django-projekt + modeller + auth + OpenAPI
2. SPA-skal med tre flikar + teman + auth-flöden
3. Ansökningar CRUD + pipeline + tidslinje + CSV
4. Idag, snabbfilter, månadsfilter, statistik, ICS
5. Platsbanken-sök + spara + sparade sökningar
6. CV parse/edit + matchning
7. Marketing, integritet, security.txt, mejl-kommandon
8. Docker + Render-blueprint + CI-tester

---

## Definition of done
- Alla tre flikar fungerar end-to-end mot riktig eller mockad JobTech
- Registrering→verifiering→login→skapa ansökan→statusbyte→CSV fungerar
- Passar mitt CV fungerar med markerade kompetenser
- Månadsfilter visar korrekt “Visar X av Y”
- Integritet + radera konto + (om CONTACT_EMAIL) security.txt
- Inga hemligheter i repo; `.env.example` dokumenterar env-vars
- Tester för kritiska API-flöden + några frontend-unit tests

Börja med en kort arkitekturplan (filer/moduler), sedan implementera steg 1.
Fråga innan du introducerar andra molntjänster än Render/Supabase/Brevo/JobTech.
```

---

## Tips vid test

| Syfte | Tips |
|-------|------|
| Jämför mot live | Låt agenten titta på https://jobbjungeln.onrender.com parallellt |
| Begränsa scope | Be den bygga bara steg 1–3 först |
| Undvik hemligheter | Ge aldrig API-nycklar i prompten — peka på `.env.example` |
