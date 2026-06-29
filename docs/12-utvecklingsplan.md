# Utvecklingsplan – Ansökt

Konkret, prioriterad plan för vidareutveckling av Ansökt. Kompletterar den
strategiska `09-master-plan.md` med faktiska uppgifter, kodkopplingar och
föreslagen ordning. Uppdaterad efter command center-redesignen av frontend.

## Nuläge (juni 2026)

**Fungerar och är i drift:**

- Django/DRF-backend (`backend/core/`) med JWT-auth, GDPR-radering och CSV-export.
- React/Vite-SPA med tre vyer: Tavlan, Annonser, Profil & CV.
- Live-sökning mot Platsbanken (JobTech) + CV-parsning och förklarbar matchning.
- Pipeline-tavla med tidslinje, snabbfilter, sök och uppföljningslista.
- Ny "command center"-design med tre teman (`command`, `daylight`, `signal`).
- ~69 backend-tester (pytest) och CI som kör ruff, black, pytest och frontend-build.

**Kända luckor (utgångspunkt för planen):**

- Inga frontend-tester eller E2E i CI.
- Ingen rate limiting på auth, uppladdning eller JobTech-proxy.
- Lösenordsåterställning är en tyst no-op i prod utan konfigurerad SMTP.
- Ingen testtäckningsmätning (`pytest-cov` saknas).
- Frontend saknar linter/formatter.
- Kod/dokument-glapp: README nämner drag-and-drop, men UI använder status-dropdown.
- Död kod: legacy `/api/v1/postings/` och oanvänt `/api/v1/applications/stats/`.
- `frontend/scripts/screenshots.mjs` refererar gamla temanamn (`forest`, `dark`).

## Spår

Planen delas i fem spår som kan löpa delvis parallellt.

| Spår | Mål |
|------|-----|
| A. Driftsäkerhet | Trygg publik lansering: monitorering, e-post, integritet |
| B. Kvalitet | Frontend-tester, linting, testtäckning, städa död kod |
| C. Produktvärde | Påminnelser, sparade sökningar, bättre matchning |
| D. Säkerhet | Rate limiting, CSV-injection, token-hantering |
| E. UX-polish | Tillgänglighet, mobil, tangentbord, stats-vy |

---

## Fas 1 – Lanseringstrygghet (1–2 sprintar)

Fokus: gör appen trygg att släppa till riktiga användare.

### A. Driftsäkerhet
- [ ] Konfigurera och verifiera produktions-SMTP så lösenordsåterställning fungerar
      (`backend/config/settings.py`, `render.yaml`). Lägg till ett röktest som
      larmar om `EMAIL_HOST` saknas i prod.
- [x] Lägg till Sentry (backend + frontend) för felrapportering.
- [ ] Uptime-check och custom domän på Render.
- [x] Integritetspolicy-sida + kort datahanteringssammanfattning (länkas i footern).
- [x] Health-endpoint varnar om `EMAIL_HOST` saknas i produktion.
- [x] Deploy-checks (`core.E001`, `core.W001`) vid `manage.py check --deploy`.
- [x] Render Cron för dagliga påminnelser (`send_reminders`, 06:00 UTC).

### B. Kvalitet
- [x] Inför Vitest + React Testing Library i `frontend/`.
- [x] Skriv röktester: inloggning, statusmodell, AuthHero-rendering.
- [x] Lägg till frontend-lint (ESLint) och kör i CI.
- [x] Lägg till `pytest-cov` med täckningströskel i CI.

### D. Säkerhet
- [x] Rate limiting på API (anon/user) samt scoped limits för CV-uppladdning och JobTech-proxy.
- [x] Mitigera CSV-injection i export (`backend/core/csv_safety.py`).

**Definition of done för fas 1:** appen kan delas publikt med fungerande
e-post, felövervakning, grundläggande missbruksskydd och automatiska röktester.

---

## Fas 2 – Värde varje dag (2–3 sprintar)

Fokus: gör appen till ett dagligt verktyg.

### C. Produktvärde
- [x] Påminnelse-e-post för förfallna `next_action_at`-rader (`send_reminders`-kommando).
- [x] Sparade JobTech-sökningar (modell + endpoints + UI i `PostingsPanel`).
- [x] Nedprioritera annonser som redan ligger på tavlan (sorteras sist, nedtonad styling).
- [ ] XLSX-export vid sidan av CSV.

### B. Kvalitet (städning)
- [ ] Besluta om legacy `/api/v1/postings/` + `import_postings`/bootstrap ska
      behållas eller tas bort. Om bort: radera vyer, tester, kommandon och docs.
- [ ] Använd `/api/v1/applications/stats/` i frontend eller ta bort endpointen.
- [x] Uppdatera README så drag-and-drop-påståendet matchar verkligheten.
- [x] Uppdatera `frontend/scripts/screenshots.mjs` till nuvarande teman och selektorer.

---

## Fas 3 – Bättre matchning (2 sprintar)

Fokus: gör matchningen till en verklig konkurrensfördel.

### C. Produktvärde
- [x] Sortera annonser efter CV-matchning (matchningsdata finns redan per träff).
- [x] Visa saknade kompetenser, inte bara matchade (`backend/core/matching.py`).
- [ ] Föreslå söktermer utifrån användarens CV.
- [ ] Låt användaren märka kompetenser som "måste ha" / "bra att ha" / "lär mig".
- [ ] Digest-mejl för sparade sökningar.

---

## Fas 4 – Retention, polish & skala (löpande)

### E. UX-polish
- [x] Tillgänglighetsförbättringar i modaler: fokus, Escape, `role="dialog"`, `aria-modal`.
- [x] Mobil-polish: safe areas, touch targets, bottom sheets, horisontell scroll.
- [ ] Kalenderexport (ICS) för intervjuer och uppföljningar.
- [ ] Mallar för anteckningar, rekryterarsamtal och intervjuförberedelse.
- [ ] Veckosammanfattning: skickade ansökningar, uppföljningar, bokade intervjuer.

### Skala (vid behov)
- [ ] Bakgrundsjobb för påminnelser och digests (Render cron eller Celery/RQ).
- [ ] Kortlivad cache för JobTech-sökningar.
- [ ] Postgres fulltextsök om lokal annonsdata växer.
- [ ] Strukturerad loggning, mätvärden och larm.

---

## Föreslagen ordning

1. **SMTP + Sentry + rate limiting** – minsta paketet för en trygg lansering.
2. **Frontend röktester + lint + täckning** – skydda mot regressioner tidigt.
3. **Städa död kod och dokument-glapp** – snabb vinst, mindre förvirring.
4. **Påminnelser** (kräver bakgrundsjobb) + **sparade sökningar**.
5. **Bättre matchning** som differentiering.
6. **Tillgänglighet och mobil-polish** löpande.

## Principer (från master-planen)

1. Användaren äger sin data – export och radering ska förbli uppenbara.
2. Appen ska minska stress, inte lägga till administration.
3. Matchning måste vara förklarbar.
4. Lagra mindre när det går – parsa CV-filer, spara aldrig uppladdningar.
5. Behåll den personliga trackern tills efterfrågan bevisar en annan yta.
