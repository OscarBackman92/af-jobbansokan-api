# GDPR & integritet

Översikt för utvecklare och personuppgiftsansvarig. Den juridiskt bindande
texten för användare finns i appen och på `/integritet/`.

## Principer

- **Dataminimering** — bara det användaren sparar (ansökningar, strukturerat CV).
  Uppladdade CV-filer lagras inte.
- **Ändamålsbegränsning** — tjänsten är en personlig tavla, inte rekrytering
  eller marknadsföring mot arbetsgivare.
- **Lagringsbegränsning** — konto kvar tills användaren raderar det; inaktiva
  konton (24 månader) gallras med 30 dagars varsel (`prune_inactive_accounts`).
- **Integritet och konfidentialitet** — TLS, åtkomstkontroll per användare,
  rate limiting, CSP i produktion.

## Vilken data lagras

| Data | Varför | Rättslig grund |
|------|--------|----------------|
| E-post, namn | Konto och inloggning | Avtal (art. 6.1 b) |
| Ansökningar (företag, roll, status, datum, kontakter, anteckningar) | Tavla | Avtal |
| Strukturerat CV (kompetenser användaren markerat, erfarenhet, utbildning) | Matchning mot annonser | Avtal |
| Sparade Platsbanken-sökningar | Veckodigest och snabb sök | Avtal |
| Tekniska loggar (IP i Render-loggar) | Drift och missbruksskydd | Berättigat intresse (art. 6.1 f) |

## Vad som inte lagras

- Uppladdade CV-filer (PDF/DOCX/TXT) — tolkas i minne
- Platsbankens annonstext som permanent kopia (live-sök + kort cache)
- Analytics eller beteendespårning
- Försäljning till arbetsgivare eller annonsörer

## Biträden (underleverantörer)

| Biträde | Roll | Region |
|---------|------|--------|
| **Render** | Applikationsserver (Frankfurt) | EU |
| **Supabase** | PostgreSQL-databas | EU (projektregion) |
| **Brevo** | Transaktionsmejl | EU-bolag |
| **Sentry** | Felrapportering (`send_default_pii=False`) | Konfigurera EU-projekt; annars möjlig USA-överföring utan PII |
| **Google** | OAuth endast om användaren väljer det och env är satt | Ireland (OAuth) |

Fullständig registerförteckning: [17-registerforteckning.md](17-registerforteckning.md).

## Användarrättigheter (implementerat)

| Rättighet | Hur |
|-----------|-----|
| Tillgång | All data synlig i appen |
| Portabilitet | Exportera tavla som CSV |
| Rättelse | Redigera profil, ansökningar, CV i appen |
| Radering | Radera konto under Profil & CV (omedelbar kaskad) |
| Invändning / begränsning | Kontakta `CONTACT_EMAIL` |

## Incident

Vid misstänkt intrång: [16-incidentrutin.md](16-incidentrutin.md) (72 h till IMY).

## Säkerhetsgranskning

Senaste audit: [19-sakerhetsaudit-2026-07-10.md](19-sakerhetsaudit-2026-07-10.md).
