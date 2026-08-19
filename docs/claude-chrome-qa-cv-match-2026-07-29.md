# Claude in Chrome — testprompt CV-matchning & Idag (2026-07-29)

Kopiera prompten i rutan nedan. Öppna appen inloggad på
**https://jobbjungeln.onrender.com/app/** (eller din miljö) innan du klistrar in.

Syfte: verifiera DEF-104/105/106 (CV-match) och DEF-101–103 (Idag-panelen).
Återställ CV:t efter testet.

---

## Kopiera prompten

```
Du är QA-testare för Jobbsöket. Jag är inloggad i den här Chrome-fliken på /app/.
Testa ENDAST punkterna nedan med verklig interaktion. Avsluta med en tydlig rapport på svenska.

## Regler
- Radera INTE kontot. Radera inte mina riktiga ansökningar.
- Ändra CV/kompetenser temporärt för matchningstest — anteckna exakt vad du markerar och ÅTERSTÄLL CV:t när du är klar (ta bort markeringar / återställ till hur det såg ut).
- Klicka INTE på “Lägg alla/… i kalender”, Exportera CSV eller .ics utan att fråga mig först.
- Radera inte kontot. Undvik “Radera allt CV-innehåll” och “Radera konto permanent”.
- Om något blockeras: markera BLOCKERAT och förklara.
- Notera exakta UI-texter, API-svar när du kan se dem (Network), antal träffar och sidnummer.
- Vid fel: flik, steg, förväntat vs faktiskt, konsolfel (F12).

## Miljö
- URL: [FYLL I, t.ex. https://jobbjungeln.onrender.com/app/]
- Dataset: [FYLL I: ca N ansökningar]
- Webbläsare: Chrome desktop
- Tema: [FYLL I]

## Kontext — vad som ska vara fixat
1. CV-match är poängbaserad: ≥20 % av markerade termer ELLER ≥2 träffade termer — inte “alla termer måste finnas”.
2. match_cv filtrerar FÖRE paginering: total = antal matchande (inom genomsökt fönster), inte hela Platsbanken. Tom sida 1 med “Sida 1 av 1640” ska vara borta.
3. Kompetenser-sektionen i redigeringsläge visar förslag grupperade per källa + “Markera alla från denna roll”, och markerade chips syns direkt.
4. Extraktion ska hitta verktyg/yrkesord även utanför första erfarenhetsraden (t.ex. SuperOffice, Visma, CRM, ERP, orderadmin).
5. Tomtillstånd för “Passar mitt CV” ska vägleda (justera kompetenser / stäng filter), inte bara “Prova annat sökord”.
6. Idag & att göra: två grupper — “Väntar på svar” vs “Sök innan sista dag”; badge “Ansök” på sparade deadlines; “väntar för länge på svar” gäller bara tystnad.
7. Chip “Att följa upp” på Ansökningar ska fortfarande bara visa uppföljningar (inte Sparad-deadlines).

---

# CHECKLISTA

Efter varje punkt: ✅ OK / ⚠️ DELVIS / ❌ FAIL / ⏭️ HOPPAT (+ en rad varför).

### A. Förbered CV (tillfälligt)
- [ ] Gå till Profil & CV → Redigera.
- [ ] Kontrollera sektionen Kompetenser: syns förslag grupperade (inte bara längst ner under varje erfarenhet)?
- [ ] Markera ~8–12 kompetenser som speglar CV:t (blanda verktyg + domän). Använd gärna “Markera alla från denna roll” på minst en rad.
- [ ] Bekräfta att markerade chips syns DIREKT i Kompetenser-rutan med räknare (t.ex. “N markerade · styr matchning…”).
- [ ] Spara CV.
- [ ] Anteckna: antal markerade + 5 exempeltermer.

### B. Extraktion (DEF-106b)
- [ ] Om CV har flera erfarenhetsrader: finns förslag från mer än bara rad 1?
- [ ] Om en rad nämner t.ex. SuperOffice / Visma / CRM / ERP / orderadmin: dyker motsvarande förslag upp?
- [ ] Anteckna antal förslag per erfarenhet-/utbildningsrad (ungefär).

### C. Annonser — Passar mitt CV (DEF-104 + DEF-105)
- [ ] Flik Annonser → kryssa “Passar mitt CV” → Sök (gärna utan extra ortfilter först, eller med dina vanliga orter).
- [ ] Förväntat: total > 0 träffar (om Platsbanken har relevanta jobb i scan-fönstret). Om 0: anteckna genomsökt antal i UI-texten och om knapparna “Justera kompetenser” / “Stäng CV-filter” syns.
- [ ] UI ska INTE visa “Visar 0 … av 40 000” med Sida 1 av ~1600 samtidigt som listan är tom.
- [ ] Om träffar finns: sidräknaren ska spegla filtrerat antal (få sidor), listan ska ha poster på sida 1.
- [ ] Öppna 2–3 toppannonser: match-räknaren (t.ex. X av N) ska vara ≥2 eller ≥20 %. Notera titel + match.
- [ ] Network (valfritt): GET /api/v1/jobs/?match_cv=true → total ska vara filtrerat antal; gärna match_cv_filtered / match_cv_scanned i svaret.

### D. Färre vs fler kompetenser (sanity)
- [ ] Tillfälligt: lämna bara 1–2 markerade kompetenser (t.ex. ett tydligt verktyg eller “Projektledning”), spara.
- [ ] Annonser + Passar mitt CV igen: ska fortfarande kunna ge träffar (inte kräva “allt”).
- [ ] Återställ till ~8–12 markeringar från steg A (eller till ursprungsläget om du hellre återställer helt här).

### E. Ansökningar — chip Passar mitt CV (DEF-106d)
- [ ] Flik Ansökningar → chip “Passar mitt CV”.
- [ ] Om 0 träffar MED kompetenser markerade: texten ska förklara tröskel / lotsa till justera kompetenser — INTE bara “Prova ett annat sökord eller byt snabbfilter”.
- [ ] Om träffar: lista ska bara visa ansökningar som når tröskeln; anteckna antal.

### F. Idag & att göra (DEF-101–103)
- [ ] Under KPI: panelen “Idag & att göra” har två grupper om båda typerna finns: “Väntar på svar (N)” och “Sök innan sista dag (M)”.
- [ ] Sparade med deadline har badge “Ansök” (inte “Deadline” som enda etikett i den meningen).
- [ ] Rubriken använder “väntar för länge på svar” för tystnad — inte att passerade Sparad-deadlines räknas in i samma siffra.
- [ ] Separata kalenderknappar per grupp syns (“Lägg uppföljningar…” / “Lägg deadlines…”) — klicka dem INTE.
- [ ] Chip “Att följa upp”: Visar bara Ansökt/uppföljning — inga Sparad-deadlines. Anteckna antal.

### G. Återställ
- [ ] Profil & CV: ta bort testmarkeringar / återställ kompetenser till hur det var före testet.
- [ ] Spara. Bekräfta evidence/skills tomma eller som innan.
- [ ] Annonser: avkryssa Passar mitt CV om det fortfarande är på.

---

## Rapportformat
1. Sammanfattning (2–4 meningar): fungerar matchningen? Idag-gruppering?
2. Tabell: punkt | status | bevis (siffror/UI-text).
3. Blockers / residualrisk.
4. Bekräftelse: CV återställt (ja/nej + vad som ändrades).
```

---

## Tips till dig som kör

1. Deploy ska vara klar för `8465bac` (eller senare) innan test.
2. Bäst med riktigt CV + flera erfarenhetsrader så extraktion och match syns.
3. Om Platsbanken är långsam vid `match_cv`: vänta ut scan (kan ta några sekunder).
