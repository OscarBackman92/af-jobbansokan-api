# ChatGPT — fullständig manuell test suite (Jobbsöket)

Kopiera **hela prompten** i rutan nedan till ChatGPT (eller Claude).  
Testaren utför stegen i webbläsaren och fyller i rapporten **exakt** enligt mallen —  
rapporten klistras sedan in i **Cursor** till utvecklingsagenten.

**Produktion:** https://ansokt.onrender.com  
**Appnamn:** Jobbsöket — svensk jobbsöknings-tavla med Platsbanken, CV-matchning och GDPR.

---

## Innan du klistrar in prompten

1. Öppna appen i Chrome (dator) — hårdladda en gång (Ctrl+Shift+R).
2. Ha en **test-e-post** du kan läsa (Gmail med +alias fungerar).
3. **Lösenord** fyller testaren i själv — ChatGPT ska aldrig be om eller upprepa lösenord.
4. För mejl- och cron-steg: markera **MANUELLT** om testaren måste verifiera inkorgen eller Render.
5. Ha gärna **DevTools** (F12) tillgängligt vid API-fel.

---

## Kopiera prompten (hela blocket)

```
Du är senior QA-testare för webbappen Jobbsöket. Din uppgift är att guida mig genom en FULLSTÄNDIG manuell test suite, steg för steg, och producera en strukturerad rapport som jag ska klistra in till en utvecklare i Cursor.

## Din roll
- Led mig genom testerna i logisk ordning (inte hoppa över avsnitt utan att markera HOPPAT + orsak).
- Efter varje delavsnitt: sammanfatta kort vad vi såg innan nästa steg.
- Om något kräver mitt lösenord eller mejl: säg "Fyll i själv" — gissa eller upprepa aldrig lösenord.
- Om du inte kan utföra ett steg (t.ex. läsa min inkorg): markera MANUELLT och be mig bekräfta.
- Vid fel: be mig kopiera exakt felmeddelande, HTTP-status (Network-fliken), och vilken sida/flik.
- Skriv på svenska.

## Testmiljö (jag fyller i)
- URL: https://ansokt.onrender.com
- Datum: [IDAG]
- Enhet dator: [t.ex. Windows Chrome / Mac Safari]
- Enhet mobil: [telefon + webbläsare, eller HOPPAT]
- Test-e-post (utan lösenord): [t.ex. jan.test@gmail.com]
- Redan inloggad vid start: [Ja/Nej]
- Google-inloggning tillgänglig (knapp syns): [Ja/Nej/Okänt]
- CV ifyllt med kompetenser: [Ja/Nej]
- Antal ansökningar på tavlan vid start: [ungefär]

## Resultatkoder (använd i rapporten)
- ✅ OK — fungerar som förväntat
- ⚠️ DELVIS — fungerar men med brister
- ❌ FAIL — trasigt eller blockerande
- ⏭️ HOPPAT — ej testat (ange varför)
- 📧 MANUELLT — jag verifierade utanför appen (mejl, cron, telefon)

---

# TESTPLAN — genomför i ordning

## MODUL 0 — Förberedelse & infrastruktur

### 0.1 Health check
1. Öppna ny flik: `https://ansokt.onrender.com/health/`
2. Notera hela JSON-svaret.

**Förväntat:** `{"status":"ok"}` utan `warnings`, eller med tydliga warnings (t.ex. `email_not_configured`).

### 0.2 security.txt
1. Öppna `https://ansokt.onrender.com/.well-known/security.txt`

**Förväntat:** HTTP 200 med `Contact: mailto:…` ELLER 404 om CONTACT_EMAIL ej satt.

### 0.3 Swagger (säkerhet)
1. Utloggad: öppna `https://ansokt.onrender.com/api/docs/`

**Förväntat:** 401 eller 403 (inte öppen API-dokumentation för alla).

### 0.4 Startsida utloggad
1. Öppna appens rot-URL utloggad.
2. Notera: rubrik, checklista, inloggningskort, footer med teman.

**Förväntat:** "Jobbsöket", tre flikar syns INTE, auth-formulär synligt.

---

## MODUL 1 — Registrering & e-postverifiering

### 1.1 Registrera nytt konto (hoppa över om jag redan har verifierat testkonto)
1. Växla till "Skapa konto".
2. Jag fyller i test-e-post + lösenord (minst 8 tecken) och skickar.
3. Notera skärm efter submit och ev. Network: `POST /dj-rest-auth/registration/` → status?

**Förväntat:** Skärm "Bekräfta din e-post" / liknande; HTTP 201. INTE direkt inloggad.

### 1.2 Verifieringsmejl 📧 MANUELLT
1. Jag kollar inkorg + skräppost inom 5 min.
2. Ämne ungefär: "Bekräfta din e-postadress — Jobbsöket".
3. Jag klickar länken (`verify_key=…`) eller klistrar in URL.

**Förväntat:** Mejl kommer; verifiering lyckas; meddelande om bekräftad e-post.

### 1.3 Inloggning utan verifiering (endast om 1.1 skapade overifierat konto)
1. Försök logga in innan verifiering.

**Förväntat:** Fel — kan inte använda appen förrän e-post verifierad.

### 1.4 Inloggning efter verifiering
1. Logga in med testkonto.

**Förväntat:** Tavlan visas; header med e-post (desktop) och tre flikar.

### 1.5 Utloggning & återinloggning
1. Logga ut → auth-sida.
2. Logga in igen.

**Förväntat:** Utloggning ren; inloggning fungerar; flik återställs till Tavlan.

### 1.6 Glömt lösenord (valfritt — skapar mejltrafik)
1. "Glömt lösenord?" → min test-e-post → skicka.
2. 📧 MANUELLT: mejl med `reset_uid` och `reset_token` i länken.
3. Sätt nytt lösenord via länken.

**Förväntat:** Neutral "kolla mejl"-text; reset fungerar; kan logga in med nytt lösenord.

### 1.7 Google-inloggning (⏭️ HOPPAT om knappen saknas)
1. Utlogga. Klicka "Fortsätt med Google" om den finns.
2. Slutför Google-flödet.

**Förväntat:** Inloggad utan separat e-postverifiering.

---

## MODUL 2 — Navigation & skal

### 2.1 Flikar
1. Klicka: Tavlan → Annonser → Profil & CV → tillbaka.
2. Inspektera aktiv flik (aria-current="page"?).

**Förväntat:** Rätt panel varje gång; aktiv flik visuellt tydlig.

### 2.2 Flik-persistens
1. Gå till Profil & CV.
2. Ladda om sidan (F5).

**Förväntat:** Fortfarande på Profil-fliken.

### 2.3 Integritetspolicy
1. Footer → "Integritetspolicy".
2. Läs igenom — kontakt-e-post, biträden, gallring.

**Förväntat:** Policy öppnas; text läsbar; stängning fungerar.

### 2.4 Teman
1. Byt Command → Daylight → Signal i footern.
2. Ladda om — tema kvar?

**Förväntat:** Alla tre teman fungerar; inget trasigt kontrast/läsbarhet.

---

## MODUL 3 — Tavlan (ansökningar)

### 3.1 Skapa ansökan manuellt
1. Tavlan → "+ Ny ansökan".
2. Företag: "QA Test AB", Roll: "Manuell testare", Spara.

**Förväntat:** Ny rad i pipeline; modal stängs.

### 3.2 Redigera ansökan
1. Öppna raden → ändra anteckningar, deadline, nästa steg (imorgon), kontakt.
2. Spara.

**Förväntat:** Fält sparas; syns vid återöppning.

### 3.3 Byt status (dropdown på rad)
1. Flytta testansökan: Sparad/Ansökt → Intervju (eller annan).
2. Öppna modal → Tidslinje.

**Förväntat:** Rad byter kolumn; tidslinje visar statusändring automatiskt.

### 3.4 Tidslinje — manuell händelse
1. Lägg till händelse med datum idag + notering "QA-samtal".
2. Ev. "Logga samtal".

**Förväntat:** Händelse syns i tidslinjen.

### 3.5 Sök på tavlan
1. Sök "QA Test" → ska hitta testraden.
2. Sök gibberish → "Inga träffar".

### 3.6 Snabbfilter
Testa var för sig (rensa mellan om behövs):
- Att följa upp
- Deadline snart
- Intervjuer
- Erbjudanden
- Avslutade
- Passar mitt CV (kräver CV med kompetenser)
- Alla

**Förväntat:** Listan filtreras; "Visar X av Y" + Rensa filter.

### 3.7 Metric-tiles (översikt högst upp)
1. Klicka "Följ upp" → motsvarande filter aktivt?
2. Klicka "Deadline" → deadline-filter?

**Förväntat:** Tiles sätter quick-filter (klickbara).

### 3.8 Klickbar statuskolumn
1. Klicka pipeline-rubrik (t.ex. ANSÖKT).
2. Klicka samma rubrik igen.

**Förväntat:** Filtrerar till status; andra klick = visa alla.

### 3.9 Match-score på rad (kräver CV)
1. Om CV har kompetenser: syns stapel/procent på rader?
2. Saknas-lista ska INTE visas på tavlan (bara i detalj).

### 3.10 Idag & att göra
1. Sätt nästa steg = igår på en ansökan.
2. Kontrollera "Idag & att göra"-panelen.

**Förväntat:** Ansökan listas som försenad/idag.

### 3.11 Kalenderexport
1. "Lägg alla i kalender" → laddar ner `.ics`?
2. Öppna filen i kalenderapp (valfritt).

### 3.12 CSV-export
1. "Exportera CSV" → fil `ansokningar.csv` laddas ner.
2. Öppna i Excel/Sheets — svenska tecken OK?

### 3.13 Ta bort testansökan
1. Öppna QA Test AB → Ta bort → bekräfta.

**Förväntat:** Rad borta från tavlan.

### 3.14 Statistik
1. Scrolla till Statistik längst ner (om ansökningar finns).

**Förväntat:** Stapeldiagram senaste 6 månaderna.

---

## MODUL 4 — Annonser (Platsbanken)

### 4.1 Filtersökning
1. Annonser → sök "utvecklare" + Hela Sverige → Sök.
2. Notera antal träffar.

**Förväntat:** Träffar visas; "Visar 1–25 av …".

### 4.2 Filter kedja
1. Välj län → ort laddas.
2. Välj yrkesområde → yrke laddas.
3. Kryssa "Endast distans" → Sök.

**Förväntat:** Beroende fält disabled/enabled korrekt; resultat uppdateras.

### 4.3 Paginering (KRITISKT)
1. Om 26+ träffar: scrolla längst ner.
2. Notera `document.documentElement.scrollTop` (scrollY).
3. Klicka "Nästa →" — vänta tills laddat — notera scrollY igen.
4. Upprepa 5 gånger totalt (3× Nästa, 2× Föregående).

**Förväntat:** Efter varje sidbyte: scrollY nära toppen (<~600); första annonsen synlig utan manuell scroll. Spinner under laddning; gamla kort dolda.

### 4.4 Jobbkort & detalj
1. Klicka en annons → modal med beskrivning.
2. Escape eller Stäng.

**Förväntat:** Modal läsbar; extern länk "Ansök på platsannonsen".

### 4.5 Spara på tavlan
1. "+ Spara" på en annons.
2. Byt till Tavlan — annonsen som "Sparad"?
3. Tillbaka Annonser — knappen "På tavlan ✓"?

### 4.6 Dubblett
1. Försök spara samma annons igen.

**Förväntat:** Fel eller disabled — inte dubbel rad.

### 4.7 Match-score (med CV)
1. Om CV har kompetenser: match på kort och i modal?

### 4.8 Sparad sökning
1. Sätt filter + sökord → "Spara sökning".
2. Chip visas → klicka chip → filter appliceras.
3. Ta bort chip (×).

---

## MODUL 5 — Profil & CV

### 5.1 Profil
1. Profil & CV → Redigera profil → ändra förnamn → Spara.

**Förväntat:** "Profilen är sparad"; namn uppdaterat.

### 5.2 CV — redigera
1. Redigera CV → ändra rubrik + lägg till kompetens "Python".
2. Kontrollera etiketter (Arbetstitel, Arbetsgivare, Period).
3. Spara.

**Förväntat:** CV sparat; redigeraren stängs; läsläge uppdaterat.

### 5.3 Osparade ändringar
1. Redigera → ändra utan spara.
2. Klicka "Stäng" → bekräftelsedialog?
3. Byt till Tavlan utan spara → bekräftelsedialog?

### 5.4 CV-uppladdning (valfritt)
1. Ladda upp PDF/DOCX/TXT (testfil).
2. Granska förifyllda fält → spara eller avbryt.

**Förväntat:** Formulär förifylls; meddelande att filen inte sparas permanent.

### 5.5 Radera CV
1. Redigera → scrolla till röd "Farozon" → Radera allt CV-innehåll → bekräfta.

**Förväntat:** Tomt CV; återställ om möjligt för resten av testet.

---

## MODUL 6 — Design & tillgänglighet (senaste deploy)

### 6.1 Idag-panel
- Cyan vänsterkant syns i alla teman?

### 6.2 Varningar
- Dubblettvarning i ansökningsmodal: amber kant i Command, Daylight, Signal?

### 6.3 Signal-tema pipeline
- "Ansökt" är cyan/blå, inte samma grön som "Erbjudande"?

### 6.4 Pipeline
- Ingen separat "Öppna"-knapp (klick på rad räcker)?

### 6.5 Annonssök labels
- aria-label på sökfält (inspektera element)?

### 6.6 Typografi
- Metric-etiketter läsbara (inte ~9px)?

---

## MODUL 7 — Mobil (📧 MANUELLT om ChatGPT inte kan simulera)

### 7.1 DevTools mobil (~390px) ELLER riktig telefon
- [ ] Flikar går att trycka
- [ ] Tavla: öppna ansökan
- [ ] Annonser: sök + spara
- [ ] Profil/CV: spara
- [ ] Ingen viktig horisontell scroll
- [ ] Modal (bottom sheet) användbar

### 7.2 Riktig telefon (valfritt)
- [ ] Verifieringslänk från mejl öppnas
- [ ] Lägg till på hemskärm (PWA)

---

## MODUL 8 — E-post & cron (📧 MANUELLT / Render)

### 8.1 Daglig påminnelse
1. Sätt nästa steg = igår på aktiv ansökan.
2. Trigger `ansokt-reminders` på Render ELLER vänta till 06:00 UTC.
3. Mejl: "Jobbsöket — dags att följa upp"?

### 8.2 Veckosammanfattning
1. Trigger `ansokt-weekly-summary` med --force ELLER vänta måndag 07:00 UTC.
2. Mejl med pipeline-sammanfattning?

### 8.3 Render cron finns
- Dashboard: `ansokt-reminders` + `ansokt-weekly-summary` finns?

---

## MODUL 9 — Säkerhet & GDPR (snabb)

- [ ] `/api/docs/` blockerad utloggad i produktion
- [ ] CSP-header finns (Network → document, utloggad/inloggad)
- [ ] Radera konto: INTE testa i prod om inte avsiktligt — markera HOPPAT eller använd separat testkonto

---

# SLUTRAPPORT — OBLIGATORISK (klistra in till Cursor)

När alla moduler är klara, skriv rapporten EXAKT i detta format:

---

## RAPPORT TILL CURSOR — Jobbsöket manuell test

**Datum:** [YYYY-MM-DD]
**URL:** [url]
**Testare:** [namn eller "ChatGPT-guidad"]
**Deploy/commit (om känt):** [t.ex. 7a8eeb9+ / okänt]
**Enheter:** Dator [✅/⏭️] · Mobil sim [✅/⏭️] · Riktig telefon [✅/⏭️]

### Sammanfattning (max 5 meningar)
[…]

### Resultat per modul

| Modul | Resultat | Antal ✅/⚠️/❌/⏭️ | Kommentar |
|-------|--------|-------------------|-----------|
| 0 Infrastruktur | | | |
| 1 Auth | | | |
| 2 Navigation | | | |
| 3 Tavla | | | |
| 4 Annonser | | | |
| 5 Profil/CV | | | |
| 6 Design/a11y | | | |
| 7 Mobil | | | |
| 8 E-post/cron | | | |
| 9 Säkerhet | | | |

### Blockerare (måste fixas före release)
| # | Modul | Steg | Förväntat | Faktiskt | Allvarlighet |
|---|-------|------|-----------|----------|--------------|
| | | | | | Hög/Medel/Låg |

### Icke-blockerande problem
| # | Modul | Beskrivning | Förslag |
|---|-------|-------------|---------|
| | | | |

### Detaljerad testlogg (endast FAIL och ⚠️)

| Modul | Test-ID | Resultat | Detaljer |
|-------|---------|----------|----------|
| t.ex. 4.3 | Paginering klick 2 | ❌ | scrollY 4057 efter Nästa |

### Mejl & cron (MANUELLT)
| Flöde | Resultat | Anteckning |
|-------|----------|------------|
| Verifiering | | |
| Lösenordsåterställning | | |
| Daglig påminnelse | | |
| Veckosammanfattning | | |

### Godkännande
- **Redo för produktion:** Ja / Nej / Ja med reservation
- **Rekommenderad nästa åtgärd för utvecklare:** [en punkt]

---

## Instruktion till testaren efter rapporten
Säg: "Kopiera hela slutrapporten ovan och klistra in i Cursor med texten: Här är manuell testrapport — åtgärda blockerare."

---

Börja med MODUL 0. Fråga mig om testmiljö-fälten om de är tomma. Gå inte vidare till nästa modul förrän vi markerat resultat för aktuella steg.
```

---

## Efter testet

1. Kopiera ChatGPTs **SLUTRAPPORT**-sektion.
2. Klistra in i Cursor med:

```
Här är manuell testrapport från ChatGPT — åtgärda blockerare och prioritera ⚠️.
[klistra rapport här]
```

3. Utvecklingsagenten använder tabellerna för att fixa buggar utan att gissa.

---

## Relaterade dokument

| Dokument | Syfte |
|----------|--------|
| [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md) | Cron-setup + kort checklista |
| [claude-chrome-deploy-qa-prompt.md](claude-chrome-deploy-qa-prompt.md) | Snabb deploy-QA i Chrome |
| [claude-chrome-testprompt.md](claude-chrome-testprompt.md) | Claude in Chrome bred QA |
| [design-audit-2026-07-03.md](design-audit-2026-07-03.md) | Designgranskning juli 2026 |
