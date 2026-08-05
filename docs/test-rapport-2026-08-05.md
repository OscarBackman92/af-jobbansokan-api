# QA-rapport — Jobbsöket (full Claude-in-Chrome)

- **Datum:** 2026-08-05
- **URL:** https://jobbjungeln.onrender.com
- **Dataset:** 82 ansökningar / 44 pågående
- **Enhet:** Desktop + simulerad mobil 390 px
- **Tema:** Command
- **Källa:** Claude in Chrome mot [claude-chrome-full-qa-prompt.md](claude-chrome-full-qa-prompt.md)

## Verdict

Solid v1. Kärnflöden (pipeline, Idag, månadsfilter, CV-match, Platsbanken,
CSV) fungerar och är användbara för AF-rapportering. Några P1/P2-buggar i
kanterna.

## Åtgärdat i kod (branch `fix/qa-p1-p2-from-full-report`)

| Prio | Problem | Åtgärd |
|------|---------|--------|
| P1 | Annonsmodal: beskrivning utanför kortet | `.job-modal` scrollar inuti kortet (`overflow: hidden` + description `min-height: 0`) |
| P2 | Marketing-footer visar rå `{" "}` | Borttagen React-literal från Django-template |
| P2 | Radera konto nära Spara/Avbryt | Visas bara i läsläge, separat sektion |
| P2 | Dubbletter i Platsbanken-lista | Dedup på `id` i API + klient |
| P3 | Browsable API i prod | Endast `JSONRenderer` när `DEBUG=0` |

## Kräver config / produktbeslut (ej kodat här)

| Prio | Problem | Nästa steg |
|------|---------|------------|
| P1 | Session i `sessionStorage` (ny flik = utloggad) | Medvetet tab-scope; alternativ: "Kom ihåg mig" + HttpOnly refresh-cookie |
| P2 | `/.well-known/security.txt` → 404 | Sätt `CONTACT_EMAIL` i Render Environment |
| P2 | Integritet utan kontakt | Samma `CONTACT_EMAIL` |
| P3 | Lösenordskrav / villkor vid registrering | Produktbeslut |
| P3 | Extern Platsbanken-datakvalitet | Visa arbetsgivare tydligare (senare) |
| P3 | Alla flikar monterade samtidigt | Lazy-unmount / virtualisering (senare) |

## Styrkor (från körningen)

- Månadsfilter + CSV bra för AF
- Idag-panelen, svenska copy, tema-picker, mobil 390 px utan overflow
- CV-match och sparade sökningar hänger ihop

Full detaljrapport finns i chatthistoriken för denna körning.
