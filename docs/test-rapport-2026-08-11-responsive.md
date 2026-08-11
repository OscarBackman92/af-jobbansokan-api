# QA-rapport — Jobbdjungeln, responsiv audit (320–1920 px)

- **Datum:** 2026-08-11 (runda 8)
- **URL:** https://jobbjungeln.onrender.com/app/
- **Repo:** OscarBackman92/af-jobbansokan-api @ main
- **Omfattning:** 30 bredder mellan 317 och 1917 px, samtliga fem tabbar
- **Källa:** Same-origin iframe-harness (resize_window låste outerWidth)

## Verdict

Underkänt före fix: appen fungerade i banden 387–760 och ≥1237, men var trasig
på små telefoner, surfplattor och laptops under ~1240 px. Rotorsak: allt under
760 px hade mobillayout, allt över antog bred desktop — utan mellansteg.

## Åtgärdat i kod

| Prio | Problem | Åtgärd |
|------|---------|--------|
| P1 | Header kollapsar 761–1236 (brand → 0 px) | Två-raders header ≤1100 px; `.tabs` scrollar med `min-width: 0` även på desktop; brand `min-width: 2.5rem` |
| P1 | Sökformulär kräver 1269 px från 961 | `auto-fit`/`minmax` för `.job-search` och `.job-search--advanced`; min-961 skriver inte längre över advanced med 7 styva kolumner |
| P1 | `.pager` spiller under 375 | `flex-wrap` + `pager-status` utan `min-width` under 400 px |
| P2 | Ordmärke spiller under 390 | Ellips på `h1`; dölj `.brand-text` under 400 px |
| P2 | Lång e-post i profilhuvud | Ellips på `.profile-id .muted` |
| P3 | lane/skill-gap/chip-spill | `minmax(min(240px,100%),1fr)`, titel-ellips, chip `max-width: 100%` |

## Testtäckning

- Ny `frontend/e2e/responsive.spec.js` över 16 bredder × fem tabbar
- Undantar `.sr-only`, `.chart`, `.tabs` och ellipserade element

## Får inte brytas

Bandet 387–760, deep-link-flikar, checkbox-storlek, Kompetenskoll-filter,
pace-tabell, en CSV-export, Spårade-KPI, match-score tooltip / shrinkage-formel.
