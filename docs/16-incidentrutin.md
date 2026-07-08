# Incidentrutin — personuppgiftsincident

Vid misstänkt dataintrång eller läcka (stulen databas, komprometterad
admin, felskickade mejl, exponerad hemlighet i git) gäller GDPR:s krav
på anmälan till IMY **inom 72 timmar** från upptäckt.

## 1. Upptäck och begränsa (direkt)

- Rotera hemligheter: `DJANGO_SECRET_KEY`, `BREVO_API_KEY`,
  `GOOGLE_CLIENT_SECRET`, databaslösenord (Render → Environment).
- Stäng av tjänsten vid pågående angrepp: Render → jobbjungeln → Suspend.
- Byt admin-lösenord och kontrollera `django_admin_log` i admin på
  konstiga inloggningar/ändringar.
- Spara loggar från Render och Sentry innan de roteras bort —
  de behövs för bedömningen.

## 2. Bedöm omfattningen (samma dag)

Svara skriftligt på:

- Vilka uppgifter berörs? (e-post, namn, ansökningar, CV-data)
- Hur många användare?
- Pågår läckan fortfarande?
- Risk för de registrerade? (ansökningsdata kan avslöja att någon
  söker jobb — känsligt gentemot nuvarande arbetsgivare)

## 3. Anmäl till IMY (inom 72 timmar)

- Anmäl via [imy.se — anmäl personuppgiftsincident](https://www.imy.se/verksamhet/dataskydd/anmal-personuppgiftsincident/).
- Anmäl hellre en gång för mycket; en anmälan kan kompletteras i
  efterhand. Undantag: incidenter som *osannolikt* medför risk för
  de registrerade behöver inte anmälas — dokumentera i så fall varför.

## 4. Informera användarna (vid hög risk)

Vid hög risk för de registrerade ska berörda användare informeras
utan onödigt dröjsmål. Skicka via Brevo till berörda konton:
vad som hänt, vilka uppgifter som berörs, vad vi gjort och vad
användaren själv bör göra (t.ex. byta lösenord).

## 5. Dokumentera (alltid, även utan anmälan)

För logg över alla incidenter (art. 33.5): datum, upptäckt hur,
omfattning, åtgärder, anmäld/inte anmäld och motivering. Lägg
dokumentationen i en privat kanal — inte i det publika repot.
