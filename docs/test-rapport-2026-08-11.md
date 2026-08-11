# QA-rapport — Jobbdjungeln (mobil iPhone 16 + Kompetenskoll)

- **Datum:** 2026-08-11
- **URL:** https://jobbjungeln.onrender.com/app/
- **Repo:** OscarBackman92/af-jobbansokan-api @ main (`0e98f20` vid körning)
- **Dataset:** 70 spårade / 59 sökta / 20 pågående / 11 sparade / 31 med matchningsdata
- **Enhet:** iPhone 16 — viewport 394×852 CSS-px, DPR 3
- **Tema:** Command
- **Konto:** Oscar Bäckman
- **Källa:** Visuell genomgång av `?tab=dash|saved|applied|postings|profile` + funktionellt test av Kompetenskoll, verifierat mot källkod

## Verdict

Kärnfunktionen håller. Sparandet från Kompetenskoll fungerar, persisteras korrekt
och får genomslag i matchningen. Det som drog ner var responsiv layout på
iPhone-bredd (två P1 i CSS utan undantag) plus en presentationsfilter-brist i
Kompetenskoll som bara syns efter omladdning.

## Åtgärdat i kod

| Prio | Problem | Åtgärd |
|------|---------|--------|
| P1 | Fliknavigeringen skriver ovanpå sig själv på mobil | Horisontellt scrollbar `.tabs` under 760 px (`overflow-x: auto`, `flex: 0 0 auto`), dold scrollbar, `scrollIntoView` på aktiv flik |
| P1 | Filterkryssrutor på Annonser som stora vita fyrkanter | Undantag för `input[type=checkbox|radio]` från bas- och mobilregler; fast 1.15 rem, `flex: 0 0 auto` |
| P2 | Kompetenskoll visar redan tillagda kompetenser efter reload | `build_skill_insights` filtrerar bort termer i aktiv profil (casefold via `canonical_skill_label`); SkillGapPanel refetchar efter add |
| P2 | "Din takt"-tabellen klipps horisontellt | Under 420 px staplas `th`/`td` och `white-space: normal` på värdecellen |
| P3 | Dubblerad "Exportera CSV" | Tog bort dubbletten i board-tools; behåller knappen i panellhuvudet |

## Följdstädning

- SkillGapPanel använder delade `addEvidenceTerm` med label `"Från gap-analys"`
- Gap-listans rader har låst grid-layout (term/meta vänster, knapp höger)
- Ny `test_insights.py` + Playwright `mobile.spec.js` (393×852)

## Kräver produktbeslut / observationer utan åtgärd

| Prio | Problem | Nästa steg |
|------|---------|------------|
| — | Kravtäckning "6 av 6" visas som 75 % | Troligen shrinkage/merit-viktning; tooltip om copy ska förklaras |
| — | Free-plan cold start (~15–18 s) | Visa "startar servern…" (redan) eller uppgradera till Starter |
| — | CDP mouse-events timeoutade i harness | Interaktion via tangentbord fungerade; troligen harness |

## Styrkor (från körningen)

- Ingen dokumentbredd-overflow (`scrollWidth === 394`) på någon flik
- KPI-rutor, staplar, tratt och histogram skalar rent
- Kompetenskoll-sparande → rätt profil, `confirmed=True`, dubblettskydd OK
- Gap-tillagda kompetenser syns som uppfyllda krav i sparade jobb / annonser
