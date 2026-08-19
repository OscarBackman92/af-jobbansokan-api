# Claude in Chrome — regressionsprompt efter QA-fixar (2026-07-26)

Kopiera prompten i rutan nedan. Öppna appen inloggad på
**https://jobbjungeln.onrender.com/app/** (eller din miljö) innan du klistrar in.

Syfte: verifiera att QA-fixarna fungerar i verklig användning — inte full
regression av hela produkten.

---

## Kopiera prompten

```
Du är QA-testare för Jobbsöket. Jag är inloggad i den här Chrome-fliken på /app/.
Testa ENDAST de nyligen åtgärdade QA-punkterna nedan. Använd verklig interaktion
(klick, formulär, statusbyten). Avsluta med en tydlig rapport på svenska.

## Regler
- Radera inte kontot. Skapa gärna 1–3 tillfälliga testposter; namnge dem med prefix "QA-fix ".
- Be mig fylla i lösenord om du loggas ut. Ändra inte mitt CV permanent — om du fyller i kompetenser för test, anteckna vad du ändrade så jag kan återställa.
- Om något blockeras (t.ex. tomt CV, saknad data), markera BLOCKERAT och förklara.
- Notera exakta UI-texter, antal träffar och datum du ser.
- Vid fel: flik, steg, förväntat vs faktiskt, eventuella konsolfel (F12).
- Ta INTE ner CSV eller radera data utan att fråga.

## Miljö
- URL: [FYLL I]
- Dataset: [FYLL I: ungefärligt antal ansökningar / eller “nyskapat testkonto”]
- Webbläsare: Chrome desktop

## Kontext — vad som ska vara fixat
1. Status → Ansökt sätter Sökt datum automatiskt om det saknades.
2. Sektioner sorteras senast sökt först (odaterade sist).
3. “Att följa upp” = tystnad (Ansökt/Telefonintervju ≥7 dagar) eller försenat nästa steg — INTE wishlist-deadline.
4. Deadline-chip/badge bara på Sparad (inte på redan ansökta).
5. “Passar mitt CV” ger vägledning till Profil & CV när kompetenser saknas (ingen rått fältnamn match_cv).
6. Sök foldar å/ä/ö (jarfalla ≈ Järfälla).
7. Formulär: tillgängliga namn, Företag/Roll med *, Escape/Avbryt varnar vid osparat.
8. Dubblett företag+roll blockerar ny ansökan.
9. Källfält finns; Platsbanken-spara sätter Källa=Platsbanken.
10. Statusbyte frågar efter datum; Ångra-toast visas.
11. Statistik “har lett till samtal…” räknar historik via tidslinje, inte bara nuvarande status.
12. Långa sektioner: max ~25 synliga + “Visa alla”.
13. Flikar speglas i URL (?tab=…).
14. Platsbanken minns senaste orter mellan besök.
15. Filterchip kan kombineras; sökfält har rensa-✕.
16. Tema “System” finns; fonter ska inte laddas från fonts.googleapis.com.

---

# CHECKLISTA

Gå i ordning. Efter varje punkt: ✅ OK / ⚠️ DELVIS / ❌ FAIL / ⏭️ HOPPAT (+ en rad varför).

### A. Sökt datum vid statusbyte
- [ ] Skapa “QA-fix Datum” som Sparad, utan sökt datum.
- [ ] Byt status till Ansökt via radens dropdown. Acceptera datumdialogen (idag).
- [ ] Rad/meta visar Sökt-datum = dagens datum.
- [ ] Öppna kortet och bekräfta Sökt datum i formuläret.

### B. Sortering
- [ ] I Ansökt-sektionen: datum ska gå nyast → äldst; tomma datum sist.
- [ ] Anteckna de 5–8 första datumen i ordning som bevis.

### C. Att följa upp vs Deadline
- [ ] KPI “Följ upp / behöver respons” och chip “Att följa upp”: ska INTE vara samma lista som bara Sparad med deadline snart.
- [ ] Om det finns Ansökt ≥7 dagar gammal utan svar: den ska synas under Att följa upp / Idag.
- [ ] Chip “Deadline snart”: bara Sparad med deadline inom 7 dagar (eller passerad sparad).
- [ ] En Ansökt-post med gammal deadline ska INTE ha deadline-badge.

### D. Passar mitt CV
- [ ] Ansökningar → chip “Passar mitt CV”.
- [ ] Om CV saknar kompetenser: tomtillstånd som lotsar till Profil & CV (inte bara “Inga träffar” utan förklaring).
- [ ] Annonser → kryssa “Passar mitt CV” utan kompetenser: feltext på svenska UTAN prefixet “match_cv:”, gärna knapp till Profil & CV.

### E. Sök å/ä/ö
- [ ] Sök “järfälla” (eller en ort med diakritik som finns i datat) och notera antal.
- [ ] Sök samma ort utan diakritik (t.ex. “jarfalla”). Samma träffar förväntas.

### F. Formulär & dubbletter
- [ ] + Ny ansökan: skärmläsar-/a11y-träd eller Labels — fälten ska ha namn (inte bara “textfält”).
- [ ] Företag och Roll markerade som obligatoriska (*).
- [ ] Fyll Företag, tryck Escape → bekräftelsedialog om osparat; Avbryt-knapp finns.
- [ ] Skapa ansökan. Försök skapa en till med samma Företag+Roll → ska blockeras med länk till befintlig.
- [ ] Källfält syns; sätt LinkedIn eller Annat och spara. Öppna igen — värdet finns kvar.

### G. Statusdatum, ångra, statistik
- [ ] Byt status på en rad: dialog frågar datum. Acceptera.
- [ ] Ångra-toast dyker upp ~några sekunder; klicka Ångra → status tillbaka.
- [ ] Statistiktexten “X har lett till samtal…”: om du har en post som varit i intervju och sedan fått avslag ska den fortfarande kunna räknas (om tidslinjen har händelsen). Notera om det känns rimligt givet datasetet.

### H. Lista, URL, filter, sök-UI
- [ ] Om en sektion har >25 poster: bara 25 syns + “Visa alla”.
- [ ] Byt till Annonser — URL får ?tab=postings (eller liknande). Backa → Ansökningar.
- [ ] Aktivera två chip samtidigt (t.ex. Intervjuer + Att följa upp om båda ger träffar) — AND-beteende.
- [ ] Skriv i sökfältet → ✕ syns och rensar.

### I. Platsbanken ort
- [ ] Annonser: välj ort(er), sök, spara en annons med + Spara.
- [ ] Ladda om Annonser — tidigare orter ska vara förvalda (senaste sökning).
- [ ] Sparad rad: Källa = Platsbanken (öppna kortet).

### J. Tema & fonter (snabb)
- [ ] Footer: tema “System” finns och går att välja.
- [ ] Network (F12): ingen request till fonts.googleapis.com / fonts.gstatic.com vid sidladdning.

### K. Teknik (valfritt men bra)
- [ ] Konsolen: noll fel under smoke ovan.
- [ ] TTFB/känsla: listan känns snabb.

---

# SLUTRAPPORT

## Sammanfattning
En mening: går det att lita på fixarna i praktiken? (Ja / Delvis / Nej)

## Resultat per bokstav A–K
Tabell eller lista: punkt → ✅/⚠️/❌/⏭️ → kort bevis (citat, antal, datumordning).

## Regressions / nya buggar
Lista allt som bröts eller känns sämre än innan (prompt-dialog, Escape-confirm, multi-chip, osv.).

## Rekommenderad nästa åtgärd
Max 3 punkter, prioriterade.

## Inte testat
Det du hoppade över.
```

---

## Tips till dig

1. Vänta tills Render deployat `d7d6439` (eller senare) innan test.
2. Bäst med ditt vanliga dataset (många ansökningar) — sortering, följ-upp och “Visa alla” syns tydligare.
3. Om Claude inte kan öppna DevTools Network för fonter: gör det själv och klistra in resultatet under J.
