# Claude in Chrome — testprompt: Sprint 1 & 2 (UX)

Kopiera prompten nedan till Claude in Chrome. Appen ska vara öppen på
**https://ansokt.onrender.com** (inloggad med ett konto som har **CV med
kompetenser** och **minst 2–3 ansökningar** på tavlan i olika statusar).

**Release:** commit `c08249e` eller senare (scroll-fix, CV-flikvarning). Ursprunglig
Sprint 1 & 2 i `a557e9c` — scroll vid paginering, CV-redigering, radera CV,
klickbara statuskolumner, match på tavlan.

---

## Retest efter scroll-fix (`c08249e`)

Använd denna **korta prompt** om full QA redan körts och bara avsnitt **A**
(plus ev. CV-flikvarning) ska verifieras igen efter deploy.

**Krav:** Render har deployat `c08249e` eller senare (kolla Render dashboard eller
vänta 1–2 min efter push).

### Kopiera retest-prompten

```
Du är QA-testare för Jobbsöket. Vi retestar en buggfix efter commit c08249e. Appen är öppen i den här fliken.

## Bakgrund (tidigare FAIL)
Vid paginering i Annonser scrollade "← Föregående" och ny sökning till resultatlistans topp, men "Nästa →" lämnade vyn längst ned (scrollY kvar ~4000). Fix: scroll efter laddning + blur på pagineringsknapp.

## Regler
- Rapportera scrollY före/efter om möjligt (document.documentElement.scrollTop).
- Avsluta med kort rapport på svenska: ✅ / ⚠️ / ❌.

## Miljö
- URL: https://ansokt.onrender.com
- Deploy: c08249e eller senare (bekräfta att sidan laddats om efter deploy)

---

# RETEST A — Scroll vid "Nästa →"

1. Gå till **Annonser**.
2. Sök t.ex. **"utvecklare"** — minst 26 träffar.
3. Scrolla **längst ner** (notera scrollY).
4. Klicka **"Nästa →"** — vänta tills nya annonser laddats (ingen spinner).
5. Kontrollera:
   - [ ] scrollY nära resultatlistans topp (ungefär som efter Föregående, t.ex. <800)?
   - [ ] Raden "Visar X–Y av Z annonser" och första annonsen syns utan manuell scroll?
6. Scrolla ner igen → **"← Föregående"** — fortfarande OK?
7. Ny sökning (t.ex. "systemutvecklare") → fortfarande OK?

**FAIL om:** "Nästa →" lämnar dig längst ned efter att resultat laddats.

---

# RETEST B (valfritt) — CV osparat vid flikbyte

Fix i c08249e: varning ska visas vid byte Profil → Tavla med osparade CV-ändringar (inte bara vid "Stäng").

1. Profil & CV → **Redigera** → ändra rubrik (spara inte).
2. Klicka fliken **Tavlan** (inte Stäng).
3. [ ] Bekräftelsedialog: "Du har osparade ändringar i CV:t. Lämna sidan utan att spara?"
4. Avbryt → stanna kvar på Profil. Acceptera → byt flik och ändringen kastas.

---

# SLUTRAPPORT (kort)

| Test | Resultat | scrollY / kommentar |
|------|----------|---------------------|
| A. Nästa → scroll | | |
| A. Föregående (regression) | | |
| B. CV flikbyte (valfritt) | | |

Rekommendation: Godkänd för release? Ja/Nej
```

---

## Innan du startar

1. **Logga in** med ett befintligt konto (Claude kan inte gissa lösenord).
2. **CV:** Fyll i minst 3–5 kompetenser (t.ex. Python, Django, PostgreSQL) under
   Profil & CV — behövs för match-test på tavlan och annonser.
3. **Tavla:** Ha minst två ansökningar i olika statusar (t.ex. Sparad + Ansökt).
   Skapa testrader om tavlan är tom.
4. Dela **aldrig** lösenord i chatten.

---

## Kopiera prompten

```
Du är QA-testare för Jobbsöket. Jag vill verifiera Sprint 1 & 2 UX-ändringar i produktion. Appen är öppen i den här fliken.

## Regler
- Be mig fylla i lösenord själv — dela aldrig lösenord i chatten.
- Fråga innan du raderar hela CV:t eller kontot permanent.
- Beskriv exakt vad du ser (texter, knappar, scroll-position, filter).
- Vid fel: sida/flik, steg, förväntat vs faktiskt, ev. konsolfel (F12).
- Avsluta med en strukturerad rapport på svenska.

## Miljö
- URL: https://ansokt.onrender.com
- Inloggad: [FYLL I: Ja/Nej]
- CV med kompetenser: [FYLL I: Ja/Nej — lista gärna 2–3 skills]
- Antal ansökningar på tavlan: [FYLL I: ungefärligt antal]

---

# FOKUS — Sprint 1 & 2 (testa i denna ordning)

Efter varje avsnitt: ✅ OK, ⚠️ DELVIS, ❌ FAIL, eller ⏭️ HOPPAT.

---

## A. Annonser — scroll vid paginering (Sprint 1)

**Förväntat:** När man byter sida i annonslistan scrollar vyn till toppen av resultatlistan (inte kvar längst ner). Från `c08249e`: scroll sker **efter** att nya resultat laddats.

1. Gå till fliken **Annonser**.
2. Kör en bred sökning som ger **minst 26 träffar** (t.ex. tom sökning eller "utvecklare" + Hela Sverige) så att paginering visas.
3. Scrolla **längst ner** på sidan (förbi flera annonskort, ev. till pagineringsknapparna).
4. Klicka **"Nästa →"** — vänta tills listan laddat klart.
5. Kontrollera:
   - [ ] Scrollade vyn till **början av resultatlistan** (nära raden "Visar X–Y av Z annonser")?
   - [ ] Syns första annonsen på nya sidan utan att jag manuellt scrollar upp?
6. Klicka **"← Föregående"** — samma kontroll.
7. Ändra sökord och klicka **Sök** (ny sökning) — scrollar det också till resultatens början?

**FAIL om:** Sidbyten lämnar dig kvar längst ner på sidan (särskilt **"Nästa →"**).

---

## B. Profil & CV — tydligare redigering (Sprint 1)

**Förväntat:** Varje erfarenhets-/utbildningsrad har synliga etiketter; "Ta bort rad" (inte bara ✕); hjälptext förklarar att borttagning gäller en rad.

1. Gå till **Profil & CV**.
2. Klicka **Redigera** på CV-kortet.
3. Kontrollera hjälptext överst i redigeraren:
   - [ ] Finns text som förklarar att varje block är en rad och att "Ta bort rad" inte raderar hela CV:t?
4. Under **Erfarenhet** (lägg till en rad om inga finns):
   - [ ] Synliga etiketter: **Arbetstitel**, **Arbetsgivare**, **Period**, **Beskrivning**
   - [ ] Knappen heter **"Ta bort rad"** (inte bara ✕)
   - [ ] Legend/rubrik typ "Erfarenhet 1"
5. Under **Utbildning**:
   - [ ] Synliga etiketter: **Lärosäte**, **Examen / inriktning**, **Period**
   - [ ] Knappen heter **"Ta bort rad"**
6. Klicka **Ta bort rad** på en testrad — bara den raden försvinner (inte hela CV:t).
7. **Stäng** utan att spara om du bara testade — bekräfta dialog om osparade ändringar om den dyker upp.

---

## C. Profil & CV — radera CV (Sprint 1)

**Förväntat:** Knapp **"Radera CV"** tömmer allt CV-innehåll efter bekräftelse.

1. Se till att CV:t har innehåll (rubrik eller kompetenser räcker).
2. Kontrollera:
   - [ ] Knappen **"Radera CV"** syns (röd/sekundär) bredvid Redigera/Ladda upp
3. Klicka **Radera CV** → bekräfta i dialogen (fråga mig om OK om du är osäker).
4. Efter radering:
   - [ ] Meddelande typ "CV:t är raderat"
   - [ ] Läsläge visar "Inget CV ännu…"
   - [ ] "Radera CV"-knappen försvinner eller är inaktiv
5. **Återställ för resten av testet:** Lägg tillbaka minst 3 kompetenser och spara (eller be mig göra det).

---

## D. Tavlan — klickbara statuskolumner (Sprint 2)

**Förväntat:** Klick på en pipeline-rubrik (t.ex. "ANSÖKT", "INTERVJU") filtrerar så att bara ansökningar i den statusen visas. Klick igen på samma rubrik = visa alla igen.

1. Gå till **Tavlan** med minst 2 ansökningar i **olika** statusar.
2. Identifiera pipeline-kolumner med rubrik + antal (t.ex. "SPARAD 1", "ANSÖKT 2").
3. Klicka på rubriken för en status som har minst 1 rad:
   - [ ] Endast den statusens ansökningar syns (andra kolumner döljs eller är tomma)
   - [ ] Filterraden visar t.ex. "Visar N av M · status: **Ansökt**" (eller motsvarande)
   - [ ] Aktiv kolumn har visuell markering (t.ex. bakgrund/highlight)
4. Klicka **samma rubrik igen**:
   - [ ] Alla statusar visas igen (filter av)
5. Klicka på **"Avslutade"** om du har avslutade ansökningar — samma beteende.
6. Klicka **"Rensa filter"** — allt återställs.

---

## E. Tavlan — CV-match & filter (Sprint 2)

**Förväntat:** Varje ansökan på tavlan kan visa match-score (X/Y kompetenser, %) om CV har kompetenser. Snabbfilter **"Passar mitt CV"** visar bara ansökningar med ≥40 % match.

**Förutsättning:** CV med kompetenser är sparat (t.ex. Python, Django, SQL).

1. På **Tavlan**, titta på enskilda ansökningsrader:
   - [ ] Syns match-indikator (stapel + "X/Y kompetenser" och procent) på minst en rad?
   - [ ] Om ingen rad matchar alls — notera det (kan vara OK om titlar saknar dina skills)
2. Skapa eller redigera en testansökan med titel som innehåller en av dina kompetenser (t.ex. "Python-utvecklare") — syns högre match?
3. I snabbfiltren, klicka **"Passar mitt CV"**:
   - [ ] Endast ansökningar med tydlig match (ca ≥40 %) visas
   - [ ] Antal i "Visar N av M" minskar jämfört med "Alla"
4. Byt tillbaka till **"Alla"**.

**Jämförelse (valfritt):** Gå till **Annonser**, sök jobb — match-indikator ska fortfarande fungera där som tidigare.

---

## F. Snabb regression (övrigt som kan påverkas)

- [ ] Annonser: "Spara på tavlan" fungerar fortfarande
- [ ] Tavla: status-dropdown på rad flyttar ansökan mellan kolumner
- [ ] CV: Stäng redigerare med osparade ändringar → bekräftelsedialog
- [ ] CV: Byt flik (Profil → Tavla) med osparade ändringar → bekräftelsedialog (`c08249e+`)
- [ ] Mobil (DevTools ~390px): CV-fält staplas, filterknappar går att trycka

---

# SLUTRAPPORT (obligatorisk struktur)

## Sammanfattning
- Datum:
- URL:
- Deploy ungefär: c08249e eller senare (ja/nej/osäker)
- Sprint 1+2 totalt: ✅ / ⚠️ / ❌

## Sprint 1
| Test | Resultat | Kommentar |
|------|----------|-----------|
| A. Scroll vid paginering | | |
| B. CV-etiketter & Ta bort rad | | |
| C. Radera CV | | |

## Sprint 2
| Test | Resultat | Kommentar |
|------|----------|-----------|
| D. Klickbara statuskolumner | | |
| E. Match på tavlan + "Passar mitt CV" | | |

## Problem (prioriterat)
| Prio | Område | Steg | Förväntat | Faktiskt | Skärmdump/evidence |

## Rekommendation
- Godkänd för produktion? Ja/Nej + kort motivering

Börja med avsnitt A. Fråga mig om inloggning eller CV-innehåll saknas innan du fortsätter.
```

---

## Efter testet

| Resultat | Gör så här |
|----------|------------|
| Allt grönt | Klart — ingen åtgärd |
| Bara A failade före c08249e | Kör [retest-prompten](#retest-efter-scroll-fix-c08249e) ovan |
| Scroll FAIL efter c08249e | Kontrollera Render-deploy; hårdladda (Ctrl+Shift+R) |
| Match saknas på tavla | CV måste ha sparade kompetenser; ladda om tavlan |
| "Passar mitt CV" visar inget | Normalt om inga titlar/anteckningar matchar dina skills |

Se även [claude-chrome-testprompt.md](claude-chrome-testprompt.md) för bredare QA.
