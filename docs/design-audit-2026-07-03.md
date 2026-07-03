# Designaudit — 3 juli 2026

Sammanfattning av UX/designgranskning (kod + komponenter).  
Fullständig rapport i konversation / Claude-designprompt.

## Betyg (1–5)

| Dimension | Betyg |
|-----------|-------|
| Hierarki | 4 |
| Typografi | 3 |
| Kontrast | 3 |
| Spacing | 4 |
| Konsistens | 4 |
| Mobil | 3 |
| Teman | 3 |

## Top 5 (rekommenderad ordning)

1. **Tema-variabler** — `--cyan`, `--cyan-bg`, `--amber-border` i alla teman ✅ implementerat
2. **Farozon + ConfirmDialog** — destruktiva åtgärder ⏳ delvis (CV farozon; dialog kvar)
3. **Typografiskt golv 0,7 rem** ✅ implementerat
4. **Labels på annonssök** — aria-label + större Sök ✅ delvis
5. **Metric-tiles + pipeline** — klickbara tiles, ta bort Öppna ✅ implementerat

## Känsla

**Ska:** Lugn · Pålitlig · Handlingsklar  
**Inte:** Larmig · Gamifierad · Riskabel

## Kvar (M)

- Temad `ConfirmDialog` istället för `window.confirm`
- Farozon för radera konto + ta bort ansökan
- Toast med ångra vid statusbyte
- `prefers-color-scheme` som initialt tema
- Rensa döda teman `forest` / `dark` i CSS
