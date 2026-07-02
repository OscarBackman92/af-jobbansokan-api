# Claude in Chrome — testprompt för Jobbsöket

Kopiera hela prompten i rutan **“Kopiera prompten”** nedan och klistra in i
Claude in Chrome med appen öppen på rätt URL.

## Innan du startar

1. Öppna **https://ansokt.onrender.com** i Chrome (eller din lokala URL).
2. Ha ett **testkonto** redo (e-post du kan läsa). Dela **aldrig** lösenord i chatten —
   fyll i lösenord själv när Claude ber dig.
3. **Mejl** (verifiering, återställning, cron) kan Claude normalt **inte** läsa —
   markera dessa som *“kräver manuell kontroll”* i rapporten.
4. **Riktig telefon:** Claude in Chrome styr bara Chrome på datorn. För telefon
   använder du antingen **Del 2** (DevTools mobilsimulering) eller **Del 3**
   (du testar själv på mobilen och klistrar in resultatet).

---

## Kopiera prompten

```
Du är QA-testare för webbappen Jobbsöket (jobbsöknings-tavla). Jag har appen öppen i den här fliken. Utför strukturerad testning och avsluta med en tydlig rapport på svenska.

## Regler
- Fråga mig innan du raderar kontot eller skickar riktiga mejl till okända adresser.
- Be mig fylla i lösenord och e-postverifiering själv — läs inte upp eller gissa lösenord.
- Om du inte kan slutföra ett steg (t.ex. mejl, Google OAuth, Render-cron), markera det som BLOCKERAT eller MANUELLT — förklara varför.
- Ta korta noteringar om vad du ser (texter, knappar, felmeddelanden).
- Vid fel: beskriv exakt vad som hände, vilken sida/flik, och om möjligt konsolfel (F12).

## Miljö
- URL: [FYLL I: t.ex. https://ansokt.onrender.com]
- Enhet för denna körning: [FYLL I: Dator / DevTools mobil / Riktig telefon]
- Inloggad: [FYLL I: Ja/Nej — om ja, vilket konto utan lösenord]

---

# DEL 1 — DATORTEST (Chrome, full bredd)

Gå igenom i ordning. Efter varje avsnitt: ✅ OK, ⚠️ DELVIS, ❌ FAIL, eller ⏭️ HOPPAT.

### 1. Startsida & varumärke
- [ ] Sidan laddar utan vit skärm/lång spinner
- [ ] Rubrik/tagline “Jobbsöket” syns
- [ ] Flikar: **Tavlan**, **Annonser**, **Profil & CV** (3 st)
- [ ] “Idag & att göra” är en **sektion på Tavlan**, inte en egen flik
- [ ] Footer med integritetslänk

### 2. Konto (hoppa över om redan inloggad och jag säger det)
- [ ] Registreringsformulär fungerar (be mig fylla i e-post/lösenord)
- [ ] Efter registrering: tydligt meddelande om verifieringsmejl → MANUELLT
- [ ] Inloggning med verifierat konto → Tavlan
- [ ] “Fortsätt med Google” — finns knappen? Om ja, testa endast om jag godkänner
- [ ] Utloggning fungerar

### 3. Tavlan
- [ ] Metric-rutor / översikt visas
- [ ] “+ Lägg till” eller motsvarande — skapa testansökan (Företag: “QA Test AB”, Roll: “Testare”)
- [ ] Ny rad syns i pipeline
- [ ] Byt status (t.ex. Ansökt → Intervju) — rad flyttas
- [ ] Öppna ansökan — modal med detaljer och tidslinje
- [ ] Sökfält filtrerar
- [ ] Snabbfilter (Följ upp, Deadline, etc.) fungerar
- [ ] “Idag & att göra”-panel på **Tavlan** om nästa steg är idag/igår (sätt datum om behövs)
- [ ] CSV-export laddar ner fil

### 4. Annonser (Platsbanken)
- [ ] Fliken Annonser laddar filter
- [ ] Sökning ger träffar (t.ex. “utvecklare”)
- [ ] “Spara på tavlan” på en annons
- [ ] Sparad sökning (om UI finns)
- [ ] Match-indikator om CV finns

### 5. Profil & CV
- [ ] Profil visar e-post/namn
- [ ] Redigera profil → spara → bekräftelse
- [ ] CV: öppna redigerare → ändra rubrik → Spara
- [ ] Efter spara: redigeraren STÄNGER och “sparat”-meddelande syns
- [ ] “Osparade ändringar” vid redigering utan spara
- [ ] Ladda upp CV (PDF/TXT) — formulär förifylls (valfritt)

### 6. Persistens & integritet
- [ ] Gå till Profil → ladda om sidan (F5) → fortfarande Profil-flik
- [ ] Footer → Integritetspolicy öppnas, text läsbar
- [ ] Öppna /.well-known/security.txt i ny flik — 200 med Contact eller 404

### 7. Mejl & cron (markera MANUELLT)
- [ ] Verifieringsmejl
- [ ] Lösenordsåterställning
- [ ] Daglig påminnelse (next_action_at igår + Render cron)
- [ ] Veckosammanfattning (måndag eller --force)

---

# DEL 2 — MOBILSIMULERING (samma flik, Chrome DevTools)

Om du kan: öppna DevTools → Toggle device toolbar → välj iPhone 14 eller Pixel 7, bredd ~390px. Upprepa kort:

- [ ] Navbar/flikar går att trycka utan överlapp
- [ ] Tavla: skapa eller öppna ansökan
- [ ] Annonser: scroll + spara annons
- [ ] Profil/CV: spara utan att knapp döljs av tangentbord (simulera om möjligt)
- [ ] Ingen horisontell scroll som klipper viktigt innehåll
- [ ] Text läsbar utan zoom

Rapportera enhet: “Simulerad mobil (DevTools)”.

---

# DEL 3 — RIKIG TELEFON (endast om jag skrivit resultat nedan)

Jag testar själv på telefon. När jag klistrar in mina anteckningar, sammanfatta dem i rapporten under “Riktig telefon”.

[Mina mobilanteckningar — lämna tom om ej testat:]
-

---

# SLUTRAPPORT (obligatorisk struktur)

## Sammanfattning
- Datum:
- URL:
- Dator: ✅/⚠️/❌ + en rad
- Mobil (simulerad): ✅/⚠️/❌/⏭️ + en rad
- Riktig telefon: ✅/⚠️/❌/⏭️ + en rad

## Godkända tester
| # | Område | Resultat | Kommentar |

## Problem (prioriterat)
| Prio | Område | Steg | Förväntat | Faktiskt | Förslag |

## Manuellt kvar (mejl, cron, OAuth)
- Punktlista

## Rekommendation
- Klar för användare? Ja/Nej + motivering

Börja med DEL 1. Fråga mig om inloggning behövs innan du fortsätter.
```

---

## Efter dator-test: prompt för riktig telefon

När du testat på mobilen själv, klistra in detta **efter** rapporten ovan (ny chatt eller samma):

```
Här är mina resultat från test på riktig telefon (Safari/Chrome):

Enhet: [t.ex. iPhone 15 / Samsung S24]
Webbläsare: [Safari / Chrome]
URL: https://ansokt.onrender.com

Fungerade:
-

Problem:
-

Lägg in detta i QA-rapporten under “Riktig telefon” och uppdatera slutsatsen.
```

---

## Tips

| Situation | Gör så här |
|-----------|------------|
| Claude fastnar på inloggning | Logga in själv, skriv “Jag är inloggad, fortsätt från steg 3” |
| Kallstart på Render | Vänta 30–60 s vid första laddning |
| Vill inte skapa skräp | Använd befintligt konto; hoppa registrering |
| Spara rapporten | Kopiera slutrapporten till issue, Notion eller `docs/test-rapport-YYYY-MM-DD.md` |

Se även [18-manuell-test-och-cron.md](18-manuell-test-och-cron.md) för cron och mejl.
