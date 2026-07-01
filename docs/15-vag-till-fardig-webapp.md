# Väg till färdig webapp – Jobbsöket

Samlad checklista för att ta Jobbsöket (f.d. "Ansökt") från “funktionellt
komplett” till en trygg, polerad webapp som kan delas brett. **Google Play / App Store är
avsiktligt pausat** tills webben känns stabil i veckor med riktiga
användare.

Se även [13-lanseringsplan.md](13-lanseringsplan.md) (drift & retention)
och [12-utvecklingsplan.md](12-utvecklingsplan.md) (historik).

---

## Lägesbild (juni 2026)

| Område | Status |
|--------|--------|
| Kärnfunktioner (tavla, tidslinje, Platsbanken, CV, export) | Klart |
| Säkerhet (rate limits, CSP, throttling, Sentry) | Klart |
| Tester (pytest, Vitest, ESLint, CI) | Klart |
| CV-parser (tvåkolumns-PDF) | Klart |
| Legacy `/api/v1/postings/` + `import_postings` | **Borttaget** — live `/jobs/` är enda annonskällan |
| Oanvänd `/api/v1/applications/stats/` | **Borttaget** |
| Produktionsdrift (EU-DB, domän, e-post) | Pågår / manuellt |
| E2E-röktester (Playwright, 3 flöden + CI) | Klart |
| Google-inloggning | Kod klar — kräver OAuth-klient i Google Cloud + env-vars |
| Prestanda (tracked-urls, lätt list-API, JobTech-cache) | Klart |
| Retention (veckomejl, kalender) | Idag-panel + ICS-export klart; veckomejl ej påbörjat |

**Tumregel:** ni är ~**90 %** på produktfunktioner men ~**75 %** på
“redo att dela brett” p.g.a. drift och onboarding.

---

## Fas 1 – Drift & förtroende (blockerare)

Utan detta ska appen inte marknadsföras hårt.

### Hosting & data

- [ ] **Render Frankfurt** + betald, beständig Postgres (inte free tier).
- [ ] Verifiera att `render.yaml` deployas med `region: frankfurt` och
      `plan: starter` (eller högre).
- [ ] **Backup-rutin** för Postgres (`pg_dump` schema + regelbunden export).
- [ ] Dokumentera återställningssteg (se [14-sakerhet-produktion.md](14-sakerhet-produktion.md)).

### Domän & tillgänglighet

- [ ] **Egen domän** (t.ex. `jobbsoket.se`) kopplad till Render eller Vercel+Render.
- [ ] Sätt `FRONTEND_URL` till den publika URL:en (lösenordsåterställning,
      e-postlänkar, `django.contrib.sites`).
- [ ] **Uptime-check** (UptimeRobot, Better Stack eller Render alerts).
- [ ] SSL och `DJANGO_DEBUG=0` i produktion.

### E-post

- [ ] **Brevo domänverifiering** (SPF, DKIM, DMARC).
- [ ] `DEFAULT_FROM_EMAIL` = `no-reply@dindomän.se` (inte `@brevosend.com`).
- [ ] Testa: registrering, verifieringsmejl, lösenordsåterställning, påminnelser.
- [ ] Rotera eventuellt exponerad Brevo-nyckel.
- [ ] `/health/` ska **inte** varna `email_not_configured` i prod.

### Juridik & transparens

- [ ] Publik integritetspolicy-URL (inte bara modal i appen).
- [ ] Tydlig information om datalagring i EU.
- [ ] Cookie-/lagringspolicy om analytics läggs till senare (idag: JWT i
      localStorage, ingen tredjepartsanalytics).

**Definition of done:** appen kan delas publikt med beständig EU-databas,
fungerande e-post och övervakad uppetid.

---

## Fas 2 – Kvalitet & onboarding

### Automatiserade tester

- [x] **3 E2E-röktester** (Playwright, `frontend/e2e/`):
  1. Registrera → verifiera mejl (läses från fil) → logga in
  2. Skapa ansökan på tavlan → byt status → tidslinje
  3. Sök Platsbanken (mockad JobTech) → spara annons på tavlan
- [x] E2E körs i CI (eget jobb, Chromium; backend på färsk SQLite,
      JobTech mockas — kör lokalt med `npm run test:e2e`).
- [x] CI körs nu även på push till `main`, inte bara PR.

### Inloggning & registrering

- [x] **Google-inloggning** — koden är klar och env-styrd:
  - Backend: `allauth` Google-provider + `POST /dj-rest-auth/google/`
  - Frontend: “Fortsätt med Google” i `AuthHero` (visas bara när
    `GOOGLE_CLIENT_ID` är satt; code-flow utan externa skript, CSP-säkert)
  - E-post + lösenord kvar som standard; samma e-post loggar in på
    befintligt konto (`EMAIL_AUTHENTICATION`)
  - **Återstår (manuellt):** skapa OAuth-klient i Google Cloud Console
    (redirect-URI = sajtens URL med avslutande `/`), sätt
    `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` i Render, uppdatera
    integritetspolicyn med Google som inloggningsmetod
- [ ] Tydligare felmeddelanden vid ogiltig inloggning / overifierad e-post.

### Kodstädning (påbörjad)

- [x] Ta bort legacy `/api/v1/postings/` och `import_postings`.
- [x] Ta bort oanvänd `/api/v1/applications/stats/`.
- [x] Förenkla `bootstrap` (ingen annonsimport vid boot).
- [x] Beslut om `JobPosting`: modellen behålls endast för gamla FK-rader,
      admin är read-only (ingen ny data kan skapas). Fullständig
      borttagning av `posting`-FK skjuts till v2 om behovet uppstår.

---

## Fas 3 – Retention (gör appen vardagsverktyg)

Prioritera efter Fas 1–2.

- [ ] **Veckosammanfattning** per mejl: nya ansökningar, förfallna
      uppföljningar, kommande deadlines/intervjuer.
- [ ] **ICS/kalenderexport** för `next_action_at` och intervjuhändelser.
- [ ] **Digest** för sparade Platsbanken-sökningar (nya träffar).
- [ ] Föreslå söktermer utifrån CV-kompetenser.
- [ ] Märk kompetenser: måste ha / bra att ha / lär mig.

---

## Fas 4 – Polish & export

- [ ] **XLSX-export** vid sidan av CSV.
- [ ] Anteckningsmallar (rekryterarsamtal, intervju).
- [ ] Förbättra statistik på tavlan (räkna per status i frontend om behövs).
- [x] Prestanda: kort cache (3 min) för identiska JobTech-sökningar.
- [x] Prestanda: tavlan hämtas i ett anrop (`?page_size=200`), list-API:t
      skickar inte `events` längre, Annonser-fliken använder
      `/applications/tracked-urls/` istället för att hämta alla rader.

---

## Fas 5 – Skala (vid behov)

- [ ] JobStream-API för kontinuerligt uppdaterade annonser.
- [ ] Postgres fulltextsök om lokal annonsdata återinförs.
- [ ] Strukturerad loggning, mätvärden, larm (utöver Sentry).
- [ ] Bakgrundsjobb (Render cron räcker tills volymen växer).

### Fler annonskällor (researchad juni 2026)

Utöver JobTech/Platsbanken (huvudkällan, täcker även Academic Work,
Bravura m.fl. eftersom de flesta bemanningsbolag annonserar där):

| Källa | Status | Kommentar |
|-------|--------|-----------|
| Adzuna | **Förkastad** | Testad juli 2026 — hanterar inte svenska annonser i praktiken, trots `se`-endpoint. Integrationsförsöket är borttaget. |
| **Jooble** | Kandidat | Gratis nyckel efter ansökan, sökning per land. Aggregator. |
| Indeed | Nej | Publisher-API:t stängt för nya ansökningar sedan flera år. |
| Academic Work | Nej | Inget publikt API; deras annonser finns i Platsbanken. |
| Bravura | Nej | Inget publikt API; deras annonser finns i Platsbanken. |

Platsbanken/JobTech förblir enda källan. Om en källa läggs till senare:
dedupe på annons-URL/titel+företag och märk källan per annons i UI:t.

---

## Pausat: mobilbutik (Google Play / App Store)

Gör **inte** förrän Fas 1–3 är klara och webben kör stabilt i minst några
veckor med riktiga användare.

När det är dags:

1. Gör webben till **PWA** (manifest, ikoner, service worker).
2. Paketera med **Trusted Web Activity** (Bubblewrap) för Android.
3. Google Play Console: integritetspolicy, screenshots, data safety-formulär.
4. Överväg **Capacitor** om push-notiser och iOS ska komma samtidigt.

---

## Rekommenderad ordning

```text
1. Fas 1  – EU-DB, domän, e-post, uptime          (1–3 dagar infra)
2. Fas 2  – E2E-tester + Google-inloggning        (3–5 dagar dev)
3. Fas 3  – Veckomejl, sedan kalenderexport       (1–2 sprintar)
4. Fas 4  – Polish efter användarfeedback
5. Fas 5  – Skala vid behov
6. Mobil  – först när webben känns “99 %”
```

---

## Snabbverifiering innan “soft launch”

Kör manuellt (eller automatisera som E2E):

1. Skapa konto → få verifieringsmejl → logga in.
2. Ladda upp CV (PDF) → kontrollera att fält fylls rimligt.
3. Sök Platsbanken → spara annons → se på tavlan.
4. Byt status → kontrollera tidslinje.
5. Sätt `next_action_at` i går → vänta på påminnelse-cron (eller kör
   `send_reminders` manuellt).
6. Exportera CSV → öppna i Excel utan formelinjektion.
7. Radera konto → all data borta.

---

## Principer (oförändrade)

1. Användaren äger sin data – export och radering ska vara uppenbara.
2. Appen ska minska stress, inte skapa administration.
3. Matchning ska vara förklarbar.
4. Lagra minimalt – CV-filer parsas, sparas aldrig.
5. Webb först; mobilbutik är distribution, inte ny produkt.
