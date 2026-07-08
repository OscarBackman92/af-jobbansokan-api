# Claude in Chrome — testprompt: verifieringsmejl

Kopiera prompten nedan till Claude in Chrome. Appen ska vara öppen på
**https://jobbjungeln.onrender.com** (utloggad om du ska registrera nytt konto).

**Viktigt:** Claude kan **inte** läsa din Gmail/Outlook. Du måste själv kolla
inkorgen och antingen klicka länken eller klistra in länktexten i chatten.

---

## Innan du startar

1. Bestäm en **test-e-post** du kan läsa (gärna inte samma som ditt vanliga
   Jobbsöket-konto om det redan är verifierat).
2. Ha ett **lösenord** redo (minst 8 tecken) — fyll i det själv när Claude ber;
   dela det inte i chatten.
3. Om du är inloggad med ett annat konto: **logga ut först** innan registreringstest.

---

## Kopiera prompten

```
Du är QA-testare för Jobbsöket. Jag vill verifiera att registreringsmejl (e-postverifiering) fungerar i produktion. Appen är öppen i den här fliken.

## Regler
- Be mig fylla i lösenord själv — gissa eller upprepa aldrig lösenord i chatten.
- Du kan INTE läsa min e-post. När mejl skickats: be mig kolla inkorg + skräppost och rapportera vad jag ser.
- Om jag klistrar in verifieringslänken eller öppnar den i en ny flik kan du testa verifieringsflödet.
- Dokumentera HTTP-status från nätverksanrop om du kan (särskilt registrering och verify-email).
- Avsluta med en strukturerad rapport på svenska.

## Miljö
- URL: https://jobbjungeln.onrender.com
- Test-e-post (jag fyller i): [FYLL I eller säg "jag anger i formuläret"]
- Jag är utloggad: [Ja/Nej]

---

# STEG 0 — E-post konfigurerad på servern?

1. Öppna i ny flik: https://jobbjungeln.onrender.com/health/
2. Rapportera hela JSON-svaret.
3. Om `"warnings": ["email_not_configured"]` → STOPP, markera BLOCKERAT (BREVO/EMAIL saknas i Render).
3b. Om `"warnings": ["email_delivery_unavailable:..."]` → STOPP, markera BLOCKERAT (Brevo-nyckel eller API fel — se felsökning i slutet av prompt-dokumentet).
4. Om bara `{"status":"ok"}` utan warnings → fortsätt.

---

# STEG 1 — Registrering triggar mejl (UI + API)

1. Gå till startsidan (utloggad).
2. Växla till **Skapa konto** / registrering.
3. Be mig ange test-e-post och lösenord i formuläret; jag skickar formuläret.
4. Efter submit, rapportera:
   - [ ] Syns skärmen **"Bekräfta din e-post"** med text om verifieringslänk?
   - [ ] Eller felmeddelande? (kopiera exakt text)
   - [ ] Nätverk: `POST /dj-rest-auth/registration/` → status? (201 = användare skapad, 400 = t.ex. mejl misslyckades)
5. Om fel *"Vi kunde inte skicka verifieringsmejlet"* → FAIL, mejl skickas inte från backend.

---

# STEG 2 — Manuell mejlkontroll (jag gör, du väntar)

Be mig:
1. Kolla inkorg + skräppost för test-e-posten inom 2–5 minuter.
2. Leta efter ämne ungefär: **"Bekräfta din e-postadress — Jobbsöket"**.
3. Rapportera till dig:
   - Kom mejlet? Ja/Nej
   - Avsändare (from-adress)
   - Finns länk med `verify_key=` i URL:en? (klistra in länken UTAN att publicera lösenord)

Markera:
- Mejl mottaget + giltig länk → ✅
- Registrering 201 men inget mejl → ⚠️ (kolla Brevo/avsändare)
- Registrering 400 verifieringsfel → ❌

---

# STEG 3 — Verifieringslänken (om jag gav dig länken)

1. Öppna länken `...?verify_key=...` (ny flik eller samma).
2. Rapportera:
   - [ ] "Verifierar e-post…" → "E-post bekräftad!" ?
   - [ ] Eller "Verifieringen misslyckades" + feltext?
   - [ ] Nätverk: `POST /dj-rest-auth/registration/verify-email/` → status 200?

---

# STEG 4 — Inloggning före/efter verifiering

**Före verifiering** (om du har ett färskt overifierat konto):
- Försök logga in med test-e-post + lösenord.
- Förväntat: inloggning **blockeras** (fel om overifierad e-post).

**Efter verifiering** (steg 3 klart):
- Logga in med samma uppgifter.
- Förväntat: inloggning **lyckas**, Tavlan visas.

---

# STEG 5 — Skicka om verifieringsmejl (valfritt)

Om registrering lyckades men mejl saknas, eller för att testa resend:

1. På inloggningssidan, om det finns UI för det — annars kör i konsolen:
```javascript
fetch("/dj-rest-auth/registration/resend-email/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "TEST-EPOST-HÄR" }),
}).then(r => r.status).then(console.log);
```
2. Rapportera HTTP-status (200/400).
3. Be mig kolla inkorgen igen.

---

# STEG 6 — Negativt test (valfritt, endast om jag godkänner)

- Försök registrera **samma e-post igen** → förväntat fel om konto redan finns.
- Öppna ogiltig `/?verify_key=fake` → förväntat felmeddelande om ogiltig/utgången länk.

---

# SLUTRAPPORT

## Sammanfattning
| Kontroll | Resultat |
|----------|----------|
| /health/ utan email_not_configured | |
| Registrering → "Bekräfta din e-post" | |
| POST /registration/ status | |
| Mejl mottaget (manuellt av mig) | |
| verify_key-länk fungerar | |
| Inloggning efter verifiering | |

## Problem
| Prio | Beskrivning | Förslag |

## Manuellt kvar
- Brevo Transactional logs (jag kollar i dashboard)
- Radera testkonto om jag vill

## Rekommendation
Verifieringsmejl produktionsklart? Ja/Nej/Delvis

Börja med STEG 0. Fråga om jag är utloggad och vilken test-e-post jag ska använda.
```

---

## Efter mejlet kommit (klistra in till Claude)

```
Mejlet kom. Ämne: "Bekräfta din e-postadress — Jobbsöket"
Avsändare: [t.ex. no-reply@...]
Länk: https://jobbjungeln.onrender.com/?verify_key=XXXX

Fortsätt med STEG 3–4 i testplanen.
```

---

## Om testet failar

| Symptom | Trolig orsak |
|---------|----------------|
| `email_not_configured` i /health/ | `BREVO_API_KEY` saknas i Render |
| `email_delivery_unavailable:brevo_api_key_rejected` | Ogiltig/utgången Brevo-nyckel |
| 400 vid registrering + Brevo-log **401 unauthorized IP** | **Vanligast på Render:** Renders utgående IP saknas under Brevo → Security → **Authorized IPs**. Lägg till IP från Render Logs eller **inaktivera IP-restriktion** (rekommenderat för dynamisk hosting). |
| 400 + "unrecognised IP address" i Render Logs | Samma som ovan — IP `74.220.x.x` måste auktoriseras eller IP-låset av |
| 201 men inget mejl | Skräppost, eller avsändare ej verifierad |
| Mejl men trasig länk | `FRONTEND_URL` fel i Render |

Se [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md) och Brevo-dashboard → Transactional → Logs.
