# Claude in Chrome — testprompt för Jobbsöket

För **full** genomgång av hela sajten (alla flikar, månadsfilter, CV-match,
utvärdering + rapportmall), använd:

→ **[claude-chrome-full-qa-prompt.md](claude-chrome-full-qa-prompt.md)**

Den filen är den rekommenderade prompten. Texten nedan är en kortare smoke-variant
om du bara vill snabbkolla dator + mobil.

## Innan du startar

1. Öppna **https://jobbjungeln.onrender.com** i Chrome (eller din lokala URL).
2. Ha ett **testkonto** redo. Dela **aldrig** lösenord i chatten.
3. **Mejl** och **Google OAuth** → markera MANUELLT om Claude inte kan slutföra.
4. **Render Free** kan sova (~30–60 s kallstart) — vänta innan FAIL.
5. Schemalagda cron-jobb finns **inte** i produktion; påminnelser/gallring är manuella.

---

## Kopiera prompten (kort smoke)

```
Du är QA-testare för webbappen Jobbsöket. Jag har appen öppen i den här fliken.
Gör en snabb men strukturerad smoke-test på svenska. Avsluta med kort rapport.

## Regler
- Fråga innan du raderar konto/CV eller skapar många .ics.
- Be mig fylla i lösenord själv.
- BLOCKERAT/MANUELLT om mejl, OAuth eller kallstart stoppar dig.
- Testdata med prefix “QA-”.

## Miljö
- URL: [FYLL I]
- Inloggad: [Ja/Nej]
- Enhet: [Dator / DevTools mobil]

Efter varje punkt: ✅ / ⚠️ / ❌ / ⏭️ / 🔒 MANUELLT

### 1. Skal
- [ ] Laddar (hantera kallstart)
- [ ] Jobbsöket syns; flikar Ansökningar | Annonser | Profil & CV
- [ ] Footer: tema + Integritetspolicy

### 2. Auth (om ej inloggad)
- [ ] Logga in / skapa konto (mejl MANUELLT)
- [ ] Logga ut / in igen

### 3. Ansökningar
- [ ] KPI-rutor + Idag-panel om data finns
- [ ] Skapa QA-ansökan, byt status, öppna modal/tidslinje
- [ ] Sök, snabbfilter, månadsfilter (Ansökt/Sparad)
- [ ] Statistikstaplar klickbara
- [ ] CSV-export endast om jag godkänner

### 4. Annonser
- [ ] Sök Platsbanken, spara en annons
- [ ] Passar mitt CV (om kompetenser finns)
- [ ] Spara sökning (valfritt)

### 5. Profil & CV
- [ ] Redigera profil lätt
- [ ] Markera kompetenser, spara CV
- [ ] Radera konto/CV: rör ej

### 6. Mobil (DevTools ~390px)
- [ ] Flikar, modal, ingen kritisk horisontell scroll

## Rapport
1. Sammanfattning (3–5 meningar)
2. Tabell: område | status | kommentar
3. Problem P0–P3
4. Klar för användning? Ja/Ja med reservation/Nej

Börja nu. Fråga om inloggning behövs.
```

---

## Tips

| Situation | Gör så här |
|-----------|------------|
| Vill ha allt | Använd [full QA-prompten](claude-chrome-full-qa-prompt.md) |
| Claude fastnar på login | Logga in själv → “Fortsätt från Ansökningar” |
| Kallstart | Vänta 30–60 s, ladda om |
| Mejl / manuella jobb | Se [14-sakerhet-produktion.md](14-sakerhet-produktion.md) |
