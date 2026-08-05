# Claude in Chrome — full QA & utvärdering av Jobbsöket

Kopiera **hela** rutan under **“Kopiera prompten”** och klistra in i Claude in
Chrome med appen öppen. Prompten ska gå igenom **alla användarfunktioner** och
ge både checklista och kvalitetsutvärdering.

## Innan du startar

1. Öppna **https://jobbjungeln.onrender.com** (eller lokal URL).
2. Ha ett **testkonto** redo (e-post du kan läsa). Dela **aldrig** lösenord i
   chatten — fyll i lösenord själv när Claude ber dig.
3. **Render Free** kan sova: första laddningen efter inaktivitet kan ta
   ~30–60 sekunder. Vänta och försök igen innan du markerar FAIL.
4. **Mejl** (verifiering, återställning) och **Google OAuth** kan Claude ofta
   inte slutföra — markera *MANUELLT* / *BLOCKERAT*.
5. Skapa gärna testdata med tydligt prefix (**QA-**) så det är lätt att städa.
6. Be Claude **inte** radera kontot eller riktiga ansökningar utan uttryckligt OK.

---

## Kopiera prompten

```
Du är QA-testare och produktutvärderare för webbappen Jobbsöket (jobbsökningstavla).
Jag har appen öppen i den här Chrome-fliken. Gå igenom ALLT du kan nå i UI:t —
inte bara “happy path”. Avsluta med en tydlig rapport på svenska enligt
rapportstrukturen längst ner.

## Regler
- Fråga mig innan du: raderar kontot, raderar CV-innehåll helt, skickar mejl till
  okända, klickar mass-kalender (.ics för många poster), eller exporterar om jag
  sagt nej.
- Be mig fylla i lösenord och mejlverifiering själv — läs inte upp eller gissa lösenord.
- Använd testdata med prefix “QA-” i företagsnamn/titlar där du skapar nytt.
- Om något inte går (mejl, OAuth, kallstart, saknad data): status BLOCKERAT eller
  MANUELLT + kort varför. Hoppa inte tyst över.
- Notera exakta UI-texter, felmeddelanden, antal träffar, sidnummer.
- Vid fel: flik, steg, förväntat vs faktiskt, gärna konsolfel (F12) och network-status.
- Utvärdera också UX: tydlighet, tomtillstånd, laddning, mobilvänlighet, svenska
  (inga trasiga engelska strängar), tillgänglighet (fokus, aria där det syns).

## Miljö (fyll i tillsammans med mig innan du börjar)
- URL: [FYLL I: t.ex. https://jobbjungeln.onrender.com]
- Inloggad: [Ja/Nej — om ja, e-post utan lösenord]
- Dataset: [ungefär antal ansökningar / om tomt konto]
- Enhet denna körning: [Dator / DevTools mobil]
- Tema start: [System / Command / Daylight / Signal]
- Kallstart: [väntade N sekunder? Ja/Nej]

Börja med startsida/auth om jag inte är inloggad. Fråga mig innan destruktiva steg.

Efter VARJE avsnitt: ✅ OK / ⚠️ DELVIS / ❌ FAIL / ⏭️ HOPPAT / 🔒 MANUELLT / ⛔ BLOCKERAT
plus 1–3 rader bevis. Samla UX-betyg 1–5 per huvudområde (1=dåligt, 5=utmärkt).

---

# A. LANDNING & GÄST

### A1. Marketing-startsida `/`
- [ ] Sidan laddar (hantera kallstart utan att markera FAIL för tidig timeout)
- [ ] Varumärke **Jobbsöket** syns tydligt
- [ ] CTA: **Skapa konto** / **Logga in**
- [ ] Nav/footer: **Integritet** / **Integritetspolicy**
- [ ] Sektioner om produktvärde läsbara (status, CV-match, Platsbanken m.m.)
- [ ] Länk tillbaka till startsidan från gästvy fungerar om den finns

### A2. Integritet (utan inloggning)
- [ ] Öppna integritetssidan — text läsbar, sektioner om lagring, rättigheter, CSV/radera
- [ ] Kontaktuppgift syns om den är konfigurerad
- [ ] Tillbaka till app/startsida fungerar

### A3. Tema (gäst om tillgängligt)
- [ ] Byt mellan **System**, **Command**, **Daylight**, **Signal**
- [ ] Tema sitter kvar efter omladdning (om sparas)

---

# B. AUTH & SESSION

### B1. Registrering (om jag vill skapa nytt — annars HOPPA efter fråga)
- [ ] **Skapa konto** — fält mejl/lösenord, **Visa/Dölj lösenord**
- [ ] Efter submit: tydligt om verifieringsmejl → MANUELLT att klicka länken
- [ ] Växla till **Har du redan ett konto? Logga in**

### B2. Inloggning
- [ ] **Logga in** med verifierat konto → flikar syns
- [ ] Fel lösenord ger begripligt fel (om jag godkänner ett negativt test)
- [ ] **Glömt lösenord?** → formulär **Skicka återställningslänk** → MANUELLT mejl
- [ ] **Fortsätt med Google** — finns? Testa bara om jag godkänner → annars notera synlig/ej

### B3. Session
- [ ] Header visar konto/e-post
- [ ] **Logga ut** fungerar → gästvy
- [ ] Logga in igen; flikminne (`?tab=` / localStorage) rimligt

---

# C. ANSÖKNINGAR (flik)

### C1. Översikt & KPI
- [ ] Hero: **Ansökningar** / **Din översikt**
- [ ] Metric-rutor: **Pågående**, **Följ upp**, **Deadline**, **Intervjuspår**, **Erbjudande**
- [ ] Klick på metric filtrerar listan / scrollar till listan
- [ ] Tom tavla: welcome **Snabbguide** eller empty state med **+ Ny ansökan**, **Sök annonser**, **Fyll i CV**

### C2. Idag & att göra
- [ ] Panelen syns bara när det finns att göra (annars notera frånvaro)
- [ ] Grupper om båda finns: **Väntar på svar** och **Sök innan sista dag**
- [ ] Badges/anledningar begripliga (**Uppföljning**, **Ansök**, tystnad, deadline)
- [ ] Öppna en rad → ansökningsmodal
- [ ] Kalenderknappar syns — klicka INTE mass-.ics utan att fråga

### C3. Skapa & redigera ansökan
- [ ] **+ Ny ansökan** → modal med obligatoriska **Företag**, **Roll**
- [ ] Fyll: Företag “QA Test AB”, Roll “QA Testare”, status **Sparad** eller **Ansökt**, sätt **Sökt datum** och gärna **Sista ansökningsdag** / **Nästa steg**
- [ ] **Spara** → syns i pipeline under rätt status
- [ ] Öppna igen: ändra anteckning, **Spara**
- [ ] Osparade ändringar: stäng med Escape/X → dialog **Osparade ändringar** / kasta vs fortsätt
- [ ] Statusbyte via select → modal **Byt status** med datum → **Bekräfta** → toast **Ångra** (testa ångra en gång)
- [ ] **Tidslinje**: logga en händelse (datum + text)
- [ ] Kontaktfält / **Logga samtal** om synligt — testa lätt
- [ ] **Ta bort ansökan** endast på QA-raden (bekräfta) — eller lämna kvar om jag säger det

### C4. Sök, snabbfilter, månadsfilter
- [ ] Fritextsök filtrerar på företag/roll m.m.; **Rensa sökning**
- [ ] Snabbfilter (AND): **Alla**, **Passar mitt CV**, **Att följa upp**, **Deadline snart**, **Intervjuer**, **Erbjudanden**, **Avslutade**
- [ ] Statusfilter via pipeline-rubrik (**Filtrera** / **Filtrerad**)
- [ ] **Månadsfilter**: dropdown **Alla månader** med **Ansökningsmånad** och **Sparad månad**
- [ ] Välj en ansökningsmånad → listan krymper; sammanfattning “Visar X av Y · månad: …”
- [ ] **Rensa filter** nollställer sök + chips + månad + stage
- [ ] Tomt filterläge: begriplig empty copy (särskilt **Passar mitt CV** utan kompetenser / utan träffar)

### C5. Pipeline & statistik
- [ ] Statusar syns: Sparad → Ansökt → Telefonintervju → Intervju → Skickad vidare → Erbjudande + Avslutade
- [ ] Deadline-/nästa steg-badges på kort
- [ ] Match-score syns om CV-kompetenser finns
- [ ] **Visa alla N** / **Visa mindre** om många i en stage
- [ ] **Statistik**: diagram senaste 6 mån; klick på stapel filtrerar ansökningsmånad (toggle av om samma igen)
- [ ] **Exportera CSV** — fråga mig innan du laddar ner; om OK: fil `ansokningar.csv`

---

# D. ANNONSER / PLATSBANKEN

### D1. Sök & filter
- [ ] Flik **Annonser** — hero **Platsbanken** / **Sök jobb**
- [ ] Sök t.ex. “utvecklare” eller “ekonomiassistent” → träffar eller tydligt tomt
- [ ] Ortfilter (län/kommun), yrkesfilter om tillgängligt
- [ ] **Endast distans**, **Passar mitt CV**
- [ ] Fel från Platsbanken (502/filterfel) hanteras begripligt om de uppstår
- [ ] Pagination **Föregående** / **Nästa**, “Sida X av Y”; URL `?tab=postings&page=` rimlig

### D2. Spara & detalj
- [ ] Öppna en annons — detaljmodal med match-info om CV finns
- [ ] **+ Spara** → **Sparad ✓**; syns under Ansökningar som **Sparad**
- [ ] Spara samma igen: disabled/redan sparad

### D3. Sparade sökningar
- [ ] Sätt filter → **Spara sökning** → namnge “QA sök”
- [ ] Chip syns; klick återställer filter
- [ ] Byt namn / ta bort QA-sökningen

### D4. CV-match på annonser
- [ ] Med markerade kompetenser: **Passar mitt CV** ger filtrerat antal (inte “0 av tiotusentals” med tusentals sidor)
- [ ] Tomt CV-filter: CTA **Justera kompetenser** / **Stäng CV-filter**
- [ ] Öppna 1–2 träffar: match X av N / Finns vs Saknas begripligt

---

# E. PROFIL & CV

### E1. Profil
- [ ] **Min profil**: e-post, redigera förnamn/efternamn → **Spara** → bekräftelse
- [ ] Osparade profiländringar varnar vid avbryt

### E2. CV
- [ ] **Mitt CV**: läsläge vs **Redigera**
- [ ] Redigera rubrik/sammanfattning → **Spara CV** → redigerare stängs / sparat syns
- [ ] Kompetenser: markera förslag, **Markera alla från denna roll**, lägg till manuell term
- [ ] Markerade chips syns med räknare
- [ ] Erfarenhet/utbildning: lägg till/ta bort en QA-rad (eller redigera befintlig lätt)
- [ ] Jobbprofiler: byt profil / skapa om UI tillåter (max 3) — radera inte andras utan fråga
- [ ] **Ladda upp CV** (PDF/DOCX/TXT) — valfritt; filen ska inte “sparas som fil” enligt copy
- [ ] Osparade CV-ändringar: byt flik → leave-guard
- [ ] **Radera CV** / **Radera konto** — RÖR EJ utan mitt OK

### E3. Koppling till övriga flikar
- [ ] Från Ansökningar/Annonser: “Justera kompetenser” landar rätt med fokus om det finns
- [ ] Efter kompetenser: snabbfilter **Passar mitt CV** på tavlan ger rimligt beteende

---

# F. GLOBALT, LEGAL, KANTFALL

### F1. Navigering & persistens
- [ ] Tre flikar: **Ansökningar**, **Annonser**, **Profil & CV**
- [ ] F5 på Profil → stannar på Profil (eller återställer begripligt)
- [ ] Footer: tema-picker + **Integritetspolicy** inloggad

### F2. Legal / security
- [ ] Integritetspolicy inloggad (panel eller sida)
- [ ] Öppna `/.well-known/security.txt` i ny flik — 200 med Contact eller dokumentera 404

### F3. Mejl & bakgrundsjobb (MANUELLT — schemaläggs inte i produktion)
- [ ] Verifieringsmejl
- [ ] Lösenordsåterställning
- [ ] Påminnelser / veckosammanfattning / gallring: kommandon finns men körs manuellt — notera om UI utlovar automatik som saknas

### F4. Kantfall att sticka hål på
- [ ] Dubbelklick / dubbelspara ansökan med samma URL om UI varnar
- [ ] Tom sökning / ogiltiga filter
- [ ] Lång text i anteckningar (kort smoke)
- [ ] Snabb växling mellan flikar under laddning
- [ ] Efter kallstart: login + tavla + en Platsbanken-sök fungerar

---

# G. MOBILSIMULERING (DevTools)

Om möjligt: Device toolbar ~390px (iPhone/Pixel). Kort smoke:
- [ ] Flikar tryckbara utan överlapp
- [ ] Ansökningar: öppna/skapa
- [ ] Annonser: scroll + filter
- [ ] Profil: spara synlig
- [ ] Ingen kritisk horisontell scroll; text läsbar
- [ ] Månadsfilter och snabbfilter användbara

Rapportera som “Simulerad mobil”.

---

# SLUTRAPPORT (obligatorisk)

## 1. Sammanfattning (5–8 meningar)
Vad fungerar? Vad är svagt? Är appen användbar för AF-aktivitetsrapportering
(månadsfilter, CSV, statusar)? Kallstart?

## 2. Resultattabell
| # | Område | Status | Betyg 1–5 | Bevis / kommentar |

Områden minst: Landning, Auth, Ansökningar, Idag, Månadsfilter, Annonser,
CV-match, Profil/CV, Tema, Mobil, Legal

## 3. Problem (prioriterat)
| Prio (P0–P3) | Område | Steg | Förväntat | Faktiskt | Förslag |

## 4. UX-utvärdering
- Tydlighet för ny användare:
- Tomtillstånd & felmeddelanden:
- Prestanda / laddning / kallstart:
- Tillgänglighet (det du kan se):
- Svenska / copy-konsistens:
- Starkaste 3 sakerna:
- Svagaste 3 sakerna:

## 5. Manuellt kvar
- Mejl, OAuth, destruktiva flöden, riktig telefon

## 6. Rekommendation
- Klar för daglig användning? **Ja / Ja med reservationer / Nej**
- Motivering i 3–5 punkter
- Föreslå max 5 nästa förbättringar (konkreta)

Börja nu med miljöfrågorna om något saknas, annars DEL A.
```

---

## Tips

| Situation | Gör så här |
|-----------|------------|
| Claude fastnar på login | Logga in själv → “Inloggad, fortsätt från C” |
| Kallstart | Vänta 30–60 s, ladda om en gång |
| Vill undvika skräpdata | Befintligt konto; skapa bara QA-rader |
| Spara rapport | Issue, Notion eller `docs/test-rapport-YYYY-MM-DD.md` |

Relaterade prompts (smalare scope):

- [claude-chrome-testprompt.md](claude-chrome-testprompt.md) — äldre kortare variant
- [claude-chrome-qa-cv-match-2026-07-29.md](claude-chrome-qa-cv-match-2026-07-29.md) — CV-match + Idag
- [claude-chrome-deploy-qa-prompt.md](claude-chrome-deploy-qa-prompt.md) — deploy-smoke
