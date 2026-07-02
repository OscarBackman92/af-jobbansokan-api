# Claude in Chrome — felsök & fixa verifieringsmejl (Brevo + Render)

Kopiera prompten nedan när verifieringsmejlet failar med HTTP 400
*"Vi kunde inte skicka verifieringsmejlet just nu"* trots att `/health/` svarar `ok`.

**Säkerhet:** Dela **aldrig** `BREVO_API_KEY`, lösenord eller hela API-nycklar i chatten.
Claude ska be dig klistra in nyckeln **direkt i Render/Brevo** — inte i chatten.

---

## Kopiera prompten

```
Du hjälper mig felsöka och åtgärda att Jobbsöket INTE kan skicka verifieringsmejl i produktion.

## Känt läge (QA redan körd)
- URL: https://ansokt.onrender.com
- GET /health/ → {"status":"ok"} (inga warnings före senaste deploy)
- POST /dj-rest-auth/registration/ → HTTP 400
- Fel i UI: "Vi kunde inte skicka verifieringsmejlet just nu. Försök igen om en stund."
- Resend returnerar 200 {"detail":"ok"} — det är neutralt svar, bekräftar INTE leverans
- Trolig orsak: BREVO_API_KEY finns i Render men Brevo nekar utskick. **Vanligaste orsaken på Render:** Brevo → Security → **Authorized IPs** — Renders utgående IP (se Render Logs vid 401) saknas. Alternativ: inaktivera IP-restriktion i Brevo (robustare för Render).

## SÄKERHETSREGLER (obligatoriska)
- Be mig ALDRIG skriva BREVO_API_KEY, SMTP-lösenord eller hela API-nycklar i den här chatten.
- Om en nyckel behövs: säg "Öppna Render → Environment → BREVO_API_KEY → klistra in nyckeln DÄR själv" — jag gör det utan att visa dig värdet.
- Du får be mig bekräfta med ja/nej: "Har du uppdaterat BREVO_API_KEY i Render?" — inte läsa upp nyckeln.
- Maskera allt känsligt i skärmdumpar/rapporter (t.ex. skriv "BREVO_API_KEY=***satt***").
- Logga inte ut mig från Render/Brevo utan att fråga.

## Din roll
Guida mig steg för steg i Render-dashboard och Brevo-dashboard (jag är inloggad i Chrome).
Efter varje steg: vad jag ska klicka, vad jag ska leta efter, hur jag vet att det lyckades.
Avsluta med verifiering att registrering fungerar.

---

# STEG 1 — Bekräfta felet (snabbcheck)

1. Öppna https://ansokt.onrender.com/health/ — rapportera JSON.
   - `email_not_configured` → BREVO_API_KEY saknas helt
   - `email_delivery_unavailable:brevo_api_key_rejected` → nyckeln ogiltig (efter senaste kod-deploy)
   - Bara `ok` → nyckeln finns men utskick kan ändå fallera (ofta avsändare)
2. Öppna https://ansokt.onrender.com utloggad → försök registrera med engångs-testmejl (be mig fylla i lösenord själv) — bekräfta fortfarande 400?

---

# STEG 2 — Render: miljövariabler (utan att exponera hemligheter)

Be mig öppna Render → Web Service **ansokt** → **Environment**.

Kontrollera att dessa **finns** (ja/nej — inte visa värdena):

| Variabel | Finns? | Kommentar |
|----------|--------|-----------|
| BREVO_API_KEY | | Ska vara satt (v3-nyckel från Brevo) |
| DEFAULT_FROM_EMAIL | | Måste matcha verifierad avsändare i Brevo |
| FRONTEND_URL | | t.ex. https://ansokt.onrender.com |
| DJANGO_DEBUG | | Ska vara 0 |

Om BREVO_API_KEY saknas eller är gammal:
1. Be mig gå till Brevo → SMTP & API → API Keys → skapa ny **v3 Transactional**-nyckel
2. Be mig klistra in den **endast** i Render Environment (jag gör det — du ser inte nyckeln)
3. Upprepa för **cron-jobb**: ansokt-reminders och ansokt-weekly-summary (samma nyckel)
4. **Manual Deploy** på web service

---

# STEG 3 — Brevo: avsändare och domän

Be mig öppna Brevo → **Senders, Domains & Dedicated IPs**.

1. **Senders** — finns DEFAULT_FROM_EMAIL-adressen (delen före @) som verifierad sender? Ja/Nej
2. Om **Nej**:
   - Lägg till avsändare ELLER verifiera domän (SPF/DKIM)
   - Uppdatera `DEFAULT_FROM_EMAIL` i Render till exakt den verifierade adressen
   - Deploy om
3. **Transactional → Email logs** — finns failed/blocked försök från senaste timmen? Beskriv status (utan persondata om möjligt)

Vanliga Brevo-fel:
- Sender not verified / invalid sender
- API key unauthorized (401)
- Daily quota exceeded (sällan på gratisnivå)

---

# STEG 4 — Render-loggar

Be mig öppna Render → ansokt → **Logs**.

Sök efter (eller be mig söka):
- `Signup verification e-mail failed`
- `AnymailError`
- `Brevo`

Rapportera felklass/meddelande — **maskera** eventuella nycklar eller e-postadresser.

---

# STEG 5 — End-to-end-test efter åtgärd

När BREVO + avsändare är fixat och deploy klar:

**A) Om Render Shell finns:**
Be mig köra (jag skriver kommandot i Shell, inte här med hemligheter):
`python backend/manage.py send_test_email MIN-EPOST@example.com`
→ mejl i inkorg = utskick OK

**B) Registrering i appen:**
1. Utloggad → Skapa konto med test-e-post (jag fyller lösenord)
2. Förväntat: skärm **"Bekräfta din e-post"** + POST /registration/ **201** (inte 400)
3. Jag kollar inkorg — mejl med ämne *"Bekräfta din e-postadress — Jobbsöket"* och länk `verify_key=`
4. Öppna länken → "E-post bekräftad!" → logga in

**C) /health/ igen** — inga email-warnings (eller bara ok)

---

# STEG 6 — Om det fortfarande failar

Felsökningsmatris:

| Symptom | Nästa åtgärd |
|---------|----------------|
| health: brevo_api_key_rejected | Ny nyckel i Brevo, uppdatera Render, deploy |
| 400 + Brevo log "sender" | Verifiera avsändare/domän, synka DEFAULT_FROM_EMAIL |
| 400 + inget i Brevo logs | Fel backend — kontrollera att EMAIL_BACKEND är Brevo (BREVO_API_KEY satt, inte bara SMTP) |
| send_test_email OK men registration 400 | Sällsynt — kolla Render logs vid exakt registreringstid |

---

# SLUTRAPPORT

## Åtgärder utförda (checklista)
- [ ] BREVO_API_KEY uppdaterad i Render (web + cron) — utan att exponera i chat
- [ ] DEFAULT_FROM_EMAIL matchar verifierad Brevo-avsändare
- [ ] Manual deploy körd
- [ ] send_test_email eller registrering lyckades
- [ ] /health/ utan email-varningar

## Resultat
| Test | Före | Efter |
|------|------|-------|
| POST /registration/ | | |
| Mejl mottaget | | |
| verify_key fungerar | | |

## Verifieringsmejl produktionsklart?
Ja / Nej / Delvis — motivering i en mening.

## Efter lyckad fix — gör detta hållbart
1. **Brevo Authorized IPs:** Antingen lägg till Renders IP varje gång den ändras, eller **inaktivera IP-restriktion** i Brevo (rekommenderat för Render free/starter — IP är inte statisk).
2. **Cron:** `ansokt-reminders` och `ansokt-weekly-summary` använder samma Brevo-nyckel och samma utgående IP — ska fungera nu; bekräfta vid nästa cron-körning.
3. **Deploy** senaste kod med förbättrad `/health/` så ogiltig Brevo-nyckel flaggas (ersätter falskt friskintyg).

Börja med STEG 1. Påminn mig om säkerhetsreglerna om jag råkar klistra in en API-nyckel.
```

---

## Om jag råkar klistra in en nyckel i chatten

Svar från Claude ska vara:

1. **Rotera nyckeln omedelbart** i Brevo (radera gammal, skapa ny)
2. Uppdatera Render Environment med den nya (utan att visa i chat)
3. Inte upprepa eller citera den exponerade nyckeln

---

## Relaterat

- [claude-chrome-verification-email-prompt.md](claude-chrome-verification-email-prompt.md) — testa om mejl fungerar
- [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md) — cron och manuell test
