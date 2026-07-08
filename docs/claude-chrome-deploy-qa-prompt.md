# Claude in Chrome — testprompt: deploy-verifiering (juli 2026)

Kopiera prompten nedan till Claude in Chrome med appen öppen på
**https://jobbjungeln.onrender.com** (inloggad, CV med kompetenser, några ansökningar på tavlan).

**Senaste deploy:** `7a8eeb9` eller senare (scroll-fix v2, design-audit quick wins).

---

## Innan du startar

1. **Logga in** med befintligt konto.
2. **Hårdladda** sidan en gång (Ctrl+Shift+R) så du inte testar gammal cache.
3. Testa minst **Command**-temat; byt till **Daylight** och **Signal** för design-delarna.
4. Dela aldrig lösenord i chatten.

---

## Kopiera prompten

```
Du är QA-testare för Jobbsöket. Verifiera senaste deploy (7a8eeb9+) i produktion. Appen är öppen i den här fliken.

## Regler
- Beskriv exakt vad du ser; vid scroll-test: rapportera scrollY före/efter.
- Vid design: notera vilket tema (Command/Daylight/Signal).
- Fråga innan du raderar konto, hela CV:t eller testansökningar permanent.
- Avsluta med strukturerad rapport på svenska: ✅ / ⚠️ / ❌ per avsnitt.

## Miljö
- URL: https://jobbjungeln.onrender.com
- Inloggad: [FYLL I: Ja/Nej]
- Deploy: 7a8eeb9+ (hårdladdad: Ja/Nej)

---

# A. Scroll vid paginering (e63fae0 — KRITISKT)

**Förväntat:** Efter "Nästa →" och "← Föregående" hamnar vyn vid resultatlistans början (scrollY < ~600). Listan döljs under laddning (spinner, inga gamla kort).

1. Annonser → sök "utvecklare" (26+ träffar).
2. Scrolla längst ner (notera scrollY).
3. **5 klick** med riktigt UI-klick, vänta tills laddning klar varje gång:
   - 3× "Nästa →"
   - 2× "← Föregående"
4. Tabell: # | knapp | scrollY före | scrollY efter | första annons synlig? | OK?

**FAIL:** scrollY kvar ~4000 efter laddning, eller inkonsekvent (kräver 5/5 OK).

---

# B. Sprint 1 & 2 (regression)

### B1. CV-redigering
- [ ] Etiketter: Arbetstitel, Arbetsgivare, Period, Beskrivning
- [ ] "Ta bort rad" (inte bara ✕)
- [ ] "Radera CV" finns i **redigeringsläge** längst ner i röd farozon — INTE i header bredvid Redigera

### B2. Tavla — statusfilter
- [ ] Klick på pipeline-rubrik filtrerar; klick igen = av; "Rensa filter" fungerar

### B3. Tavla — match
- [ ] Match-stapel på rader (utan lång "Saknas: …"-lista på tavlan)
- [ ] Snabbfilter "Passar mitt CV" fungerar

### B4. CV flikbyte
- [ ] Redigera CV utan spara → byt till Tavlan → bekräftelsedialog

---

# C. Design-audit quick wins (7a8eeb9)

### C1. Idag-panelen & match-färger
- [ ] Tavlan → "Idag & att göra": **cyan vänsterkant** syns (inte osynlig)
- [ ] Ansökningsrad med medel-match: **progressbar har färg** (inte grå/tom)

### C2. Varningar i alla teman
Byt tema i footern och kolla en varning (t.ex. dubblett i ansökningsmodal om möjligt):
- [ ] Command: amber kant på varning
- [ ] Daylight: amber kant syns
- [ ] Signal: amber kant syns; **"Ansökt" i pipeline är cyan/blå**, inte samma grönt som erbjudande

### C3. Metric-tiles på Tavlan
- [ ] Hover-lyft **bara** på tiles (inte på statiska kort i Annonser-hero)
- [ ] Klick "Följ upp" → quick-filter "Att följa upp" aktivt
- [ ] Klick "Deadline" → filter "Deadline snart"
- [ ] Etiketter (PÅGÅENDE, FÖLJ UPP) läsbara (~11+ px, inte mikroskopiska)

### C4. Pipeline-rader
- [ ] Ingen separat **"Öppna"**-knapp — klick på raden öppnar modal
- [ ] Status-dropdown finns kvar

### C5. Annonser — tillgänglighet
- [ ] Skärmläsare eller Inspektera: sökfält har aria-label (Sökord, Län, Ort, …)
- [ ] **Sök**-knappen är tydlig (inte bara liten "small")

### C6. Flikar
- [ ] Aktiv flik har aria-current="page" (inspektera element)

---

# D. Snabb regression

- [ ] Registrering/inloggning (hoppa om redan inloggad)
- [ ] Spara annons på tavlan
- [ ] Status-dropdown flyttar kort
- [ ] Mobil DevTools ~390px: flikar, sökformulär, pipeline (om miljön tillåter)

---

# SLUTRAPPORT

## Sammanfattning
| Område | Resultat |
|--------|----------|
| A. Scroll paginering | |
| B. Sprint 1 & 2 | |
| C. Design-audit | |
| D. Regression | |

## Blockerare (om några)
- Punktlista

## Rekommendation
Godkänd för produktion? **Ja / Nej / Ja med reservation**

Börja med A (scroll). Fråga om inloggning behövs.
```

---

## Snabbversion (endast scroll)

```
Retesta scroll 7a8eeb9+ på jobbjungeln.onrender.com → Annonser → "utvecklare" → scroll ner → 5× paginering (3 Nästa, 2 Föregående). Rapportera scrollY före/efter. Kräver 5/5 med scrollY <600. Ja/Nej.
```

---

## Efter testet

| Resultat | Åtgärd |
|----------|--------|
| Scroll FAIL | Rapportera exakt vilka klick; ev. ny fix |
| C1 FAIL (ingen cyan kant) | Kontrollera deploy 7a8eeb9+ och tema |
| Metric-tiles inte klickbara | Hårdladda; kolla BoardPanel deploy |

Se även [claude-chrome-sprint1-2-qa-prompt.md](claude-chrome-sprint1-2-qa-prompt.md),
[claude-design-prompt.md](claude-design-prompt.md).
