# Registerförteckning (art. 30 GDPR)

Personuppgiftsansvarig: den som driver Jobbsöket (kontakt: se
`CONTACT_EMAIL` i produktionsmiljön). Senast uppdaterad: juli 2026.

## Behandling 1: Användarkonton och ansökningsdata

| | |
| --- | --- |
| Ändamål | Tillhandahålla ansökningsöversikten: konto, ansökningar, CV-matchning, påminnelser |
| Kategorier av registrerade | Registrerade användare (arbetssökande) |
| Kategorier av uppgifter | E-post, namn, ansökningar (företag, roll, status, datum, kontakter, anteckningar), strukturerat CV (kompetenser, erfarenhet, utbildning) |
| Rättslig grund | Avtal (art. 6.1 b) |
| Mottagare/biträden | Render (applikationsdrift, Frankfurt/EU), Supabase (Postgres, EU), Brevo (transaktionsmejl, EU) |
| Tredjelandsöverföring | Nej för lagrad data (EU-region). Sentry (felrapportering) kan innebära överföring till USA — konfigurerad utan personuppgifter (`send_default_pii=False`) |
| Gallring | Vid kontoradering (omedelbart, kaskad) eller efter 24 månaders inaktivitet med 30 dagars varsel (`prune_inactive_accounts`) |
| Säkerhetsåtgärder | TLS/HSTS, CSP, rate limiting, JWT med rotation + svartlistning, ägarfiltrerade API:er, lösenordshashning (PBKDF2), EU-hosting |

## Behandling 2: Google-inloggning (valfritt — endast om konfigurerat)

Aktivt endast när `GOOGLE_CLIENT_ID` och `GOOGLE_CLIENT_SECRET` är satta.
I produktion juli 2026 används mejl + lösenord; OAuth är förberett i kod men
ej aktiverat.

| | |
| --- | --- |
| Ändamål | Alternativ inloggning |
| Kategorier av uppgifter | E-post och namn från Googles OAuth-svar |
| Rättslig grund | Avtal (art. 6.1 b) |
| Mottagare | Google Ireland Ltd (gemensamt ansvarig för själva inloggningen) |
| Gallring | Som behandling 1 — kopplingen raderas med kontot |

## Behandling 3: Drift- och säkerhetsloggar

| | |
| --- | --- |
| Ändamål | Felsökning, skydd mot missbruk (rate limiting), tillgänglighet |
| Kategorier av uppgifter | IP-adresser i webbserverloggar (Render), tekniska felrapporter (Sentry, utan personuppgifter) |
| Rättslig grund | Berättigat intresse (art. 6.1 f) — säker drift |
| Gallring | Renders logretention (kort, hanteras av plattformen) |

## Uppladdade CV-filer

Behandlas i minnet vid tolkning och **lagras aldrig** — endast de
strukturerade fält användaren själv sparar behålls (behandling 1).
