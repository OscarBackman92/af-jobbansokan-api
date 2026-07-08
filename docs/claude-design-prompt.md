# Claude — designprompt för Jobbsöket

Använd denna prompt med **Claude in Chrome** (appen öppen i fliken) eller i vanlig
Claude-chatt med skärmdumpar. Målet är en **konkret design- och UX-granskning** —
inte generisk inspiration, utan prioriterade förbättringar som går att implementera.

**Produktion:** https://jobbjungeln.onrender.com  
**Stack:** React + Vite, en CSS-fil (`frontend/src/styles.css`), inget Tailwind/shadcn.

---

## Innan du startar

1. Öppna appen och logga in (eller granska utloggad startsida först).
2. Testa alla **tre teman** i footern: **Command** (default), **Daylight**, **Signal**.
3. Ha minst några ansökningar på tavlan och ett ifyllt CV för realistisk vy.
4. Växla till **DevTools → mobil** (~390px) för minst en vy per huvudflik.
5. Dela aldrig lösenord i chatten.

---

## Kopiera prompten

```
Du är senior produktdesigner och UX-granskare för den svenska webbappen Jobbsöket — en jobbsöknings-tavla med Platsbanken-integration, CV-matchning och GDPR-fokus. Jag har appen öppen [i den här fliken / bifogar skärmdumpar].

## Din uppgift
Gör en strukturerad designaudit. Var ärlig och specifik. Undvik fluff ("snyggt", "modernt") utan förklaring. Varje rekommendation ska ha: **var** (skärm/komponent), **problem**, **förslag**, **prioritet** (Hög/Medel/Låg).

## Produktkontext
- **Målgrupp:** Svenska jobbsökare som vill ha koll på ansökningar utan Excel.
- **Kärnflöden:** Tavla (pipeline) → Annonser (sök & spara) → Profil/CV (match).
- **Ton:** Professionell men vänlig, svenska UI-texter, "command center"-känsla i default-temat.
- **Konkurrensreferenser (inspiration, inte kopiera):** Huntr, Teal, Notion-kanban — men enklare och mer svensk/offentlig sektor-vänlig.

## Befintligt designsystem (respektera — föreslå inte total rebrand)
- **Teman:** `command` (mörk cyan/indigo, default), `daylight` (ljus lila), `signal` (mörk grön accent).
- **CSS-variabler:** `--brand`, `--surface`, `--ink`, `--muted`, `--grad`, statusfärger `--st-applied` m.fl.
- **Typografi:** System-ui + JetBrains Mono för vissa detaljer.
- **Komponenter:** metric-tiles, pipeline-stages, job-cards, match-score, modaler, cards med `--radius` 14–16px.
- **Flikar:** Tavlan · Annonser · Profil & CV (3 st). "Idag & att göra" är sektion på Tavlan.

## Regler för dig
- Alla förslag ska fungera med **vanlig CSS** (ingen obligatorisk Figma-ombyggnad).
- Behåll tillgänglighet: kontrast, fokusringar, `aria`, tangentbord.
- Föreslå inte dark-only — alla tre teman ska hålla ihop.
- Skriv på **svenska** i rapporten; UI-exempel på svenska.
- Om du inte ser en vy: be mig navigera dit eller skicka skärmdump.
- Skilj på **visuellt** (typografi, spacing, hierarki) och **UX** (flöde, klick, cognitive load).

---

# DEL 1 — Visuell inventering (gå igenom i ordning)

För varje vy: 2–4 meningar om första intryck, sedan bullet-problem.

### 1. Header & navigation
- [ ] Logo, tagline, flikar, e-post, utloggning — balans och andningsrum?
- [ ] Aktiv flik tydlig i alla teman?
- [ ] Fungerar header på mobil (~390px)?

### 2. Tavlan (BoardPanel)
- [ ] Command hero + metric-rutor — läsbar hierarki eller rörigt?
- [ ] "Idag & att göra"-panel — sticker den ut tillräckligt?
- [ ] Pipeline-kolumner — statusfärger, klickbara rubriker, radtäthet?
- [ ] Match-score på rader — integrerat eller klumpigt?
- [ ] Snabbfilter (piller) — scanbarhet, aktivt tillstånd?
- [ ] Tomt tillstånd / inga träffar — uppmuntrande eller steril?

### 3. Annonser (PostingsPanel)
- [ ] Sökformulär — för många fält på en rad? Mobil?
- [ ] Jobbkort — titel, företag, badges, match, CTA "Spara"?
- [ ] Paginering och resultaträknare?
- [ ] Jobbmodal (detalj) — läsbarhet för lång beskrivning?

### 4. Profil & CV (ProfilePanel)
- [ ] Profilkort (avatar, namn)?
- [ ] CV läsläge vs redigerarläge — tydlig struktur (erfarenhet/utbildning)?
- [ ] Fältgrupper, "Ta bort rad", Radera CV — farlig action visuellt avgränsad?
- [ ] Uppladda CV-knapp — upptäckbar?

### 5. Auth (utloggad)
- [ ] Hero + checklista + inloggningskort — konvertering och förtroende?
- [ ] Registrering / glömt lösenord — enkelhet?

### 6. Modaler & detaljer
- [ ] ApplicationModal — formulär, tidslinje, kontaktpanel?
- [ ] Integritetspolicy-panel?

### 7. Footer
- [ ] Temaväljare — förståelig? Störande?

---

# DEL 2 — Systematisk designgranskning

Betygsätt 1–5 (5 = utmärkt) med en rad motivering vardera:

| Dimension | Betyg | Kommentar |
|-----------|-------|-----------|
| Visuell hierarki | | Vad ska jag se först på Tavlan? |
| Typografi & läsbarhet | | Rubriker vs brödtext, radlängd |
| Färg & kontrast (WCAG) | | Särskilt Command + muted text |
| Spacing & rytm | | Cards, pipeline, formulär |
| Komponentkonsistens | | Knappar, badges, inputs |
| Mikrointeraktioner | | Hover, loading, tomma states |
| Mobil (~390px) | | Touch targets, horisontell scroll |
| Teman (Command/Daylight/Signal) | | Känns som samma produkt? |

---

# DEL 3 — Förbättringsförslag (det viktigaste)

Lista **minst 8** och **högst 15** förslag i tabell:

| Prio | Vy | Problem | Förslag (konkret) | Effort S/M/L |
|------|-----|---------|-------------------|--------------|

**Effort:** S = CSS/en komponent, M = flera komponenter, L = ny layout/struktur.

Inkludera minst:
- 2 snabba vinster (S) som förbättrar upplevd kvalitet direkt
- 1 tillgänglighetsfix (kontrast/fokus/touch)
- 1 mobilfix
- 1 förslag du medvetet **inte** rekommenderar (och varför)

---

# DEL 4 — Valfria riktningar (välj en om jag ber dig)

Om jag vill gå djupare, välj EN spår och utveckla 3 skisser i text:

**A. "Calm productivity"** — lugnare, mer whitespace, mindre "gamer command center"  
**B. "Skarp kanban"** — tydligare pipeline, Trello-lik tydlighet, behåll mörkt tema  
**C. "Trust & clarity"** — mer offentlig/sektor-vänlig, lägre visuell brus för 35–55 år

För vald riktning: beskriv ändringar i färger, typografi, spacing och EN exempel-skärm (Tavlan).

---

# SLUTRAPPORT (obligatorisk)

## Executive summary (max 5 meningar)

## Styrkor (3 punkter)

## Svagheter (3 punkter)

## Top 5 att implementera nästa sprint
1. …
2. …

## Design debt att leva med (medvetet)
- …

## Moodboard i ord (3 adjektiv appen ska kännas som + 3 den inte ska)

Börja med DEL 1 vy 1 (Header). Fråga om inloggning om du behöver se Tavlan.
```

---

## Variant: endast en skärm

Om du vill granska **en** vy (snabbare):

```
Designgranska endast [Tavlan / Annonser / Profil & CV / Auth] i Jobbsöket på https://jobbjungeln.onrender.com.
Tema: [command / daylight / signal]. Enhet: [desktop / 390px mobil].
Leverera: första intryck, 5 problem, 5 konkreta CSS-vänliga fixes med prioritet. Svenska.
```

---

## Efter granskningen

| Nästa steg | Gör så här |
|------------|------------|
| Implementera förslag | Ge mig "Top 5"-listan i Cursor — jag kodar i `styles.css` + komponenter |
| A/B-tema | Testa Daylight som default för nya användare — produktbeslut |
| Spara rapport | `docs/design-audit-YYYY-MM-DD.md` eller GitHub issue |

Se även [12-utvecklingsplan.md](12-utvecklingsplan.md) (E. UX-polish) och
[claude-chrome-testprompt.md](claude-chrome-testprompt.md) (funktionell QA).
