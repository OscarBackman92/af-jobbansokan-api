# Lanseringsplan – Ansökt

Ny plan beslutad juni 2026, efter att Fas 1–3 i `12-utvecklingsplan.md` i
praktiken är klara. Fokus skiftar från "bygga funktioner" till "göra
appen redo för riktiga användare" och därefter retention.

## Lägesbild

Appen är i drift på <https://ansokt.onrender.com> och funktionellt
komplett: tavla, tidslinje, fri inmatning, live Platsbanken-sök med
förklarbar CV-matchning, e-postverifiering, operatör-ID, Sentry, rate
limiting, cron-påminnelser, sparade sökningar, integritetspolicy, dublett-
skydd och CSV-export. Frontend-tester (Vitest), ESLint och pytest-cov
körs i CI.

Det är inte längre en prototyp – kvarvarande blockerare är infrastruktur
och juridik, inte saknad funktionalitet.

## Kan den lanseras publikt?

Ja, men inte på nuvarande gratisnivå. Blockerare:

| Blockerare | Konsekvens |
|---|---|
| Render free-tier | Kallstart efter inaktivitet; gratis-Postgres upphör efter 90 dagar (datförlust). |
| Hosting-region | Sannolikt USA. Tredje persons PII (rekryterare) → GDPR pekar mot EU (Render Frankfurt). |
| E-postleverans | Mejl från `@brevosend.com` hamnar i skräppost; kräver domänverifiering. |
| Egen domän + uptime | `*.onrender.com` saknar trovärdighet; ingen uptime-övervakning. |

**Rekommendation:** stanna på Render, uppgradera webb + Postgres till
betald plan i **Frankfurt**, koppla egen domän. `render.yaml` är redan
konfigurerad. Alternativ vid nollbudget: Fly.io (EU) eller Hetzner-VPS.

---

## Fas A – Publik lansering (infra/juridik)

- [ ] EU-region (Frankfurt) + betald, beständig Postgres.
- [ ] Domänverifiering i Brevo + `no-reply@dindomän` som avsändare.
- [ ] Egen domän + uptime-check (UptimeRobot eller Render).
- [ ] Rotera den tidigare exponerade Brevo SMTP-nyckeln.
- [ ] Backup-rutin för Postgres.

**Definition of done:** appen kan delas publikt med beständig databas i
EU, fungerande e-post som inte fastnar i skräppost och övervakad uppetid.

## Fas B – Förtroende & städning (parallellt)

- [ ] 2–3 E2E-röktester: registrering → tavla → spara annons.
- [x] Ta bort legacy `/api/v1/postings/` + `import_postings`.
- [x] Ta bort oanvänd `/api/v1/applications/stats/`.
- [ ] Google-inloggning (vid sidan av e-post).
- [ ] XLSX-export vid sidan av CSV.

Se [15-vag-till-fardig-webapp.md](15-vag-till-fardig-webapp.md) för full lista.

## Fas C – Stickiness (retention)

- [ ] **Veckosammanfattning** per mejl: skickade ansökningar, förfallna uppföljningar, bokade intervjuer. (Högst värde.)
- [ ] **ICS/kalenderexport** för intervjuer och `next_action_at`.
- [ ] **Digest-mejl** för sparade sökningar (nya träffar sedan sist).
- [ ] Föreslå söktermer utifrån CV:t.
- [ ] Märk kompetenser som "måste ha" / "bra att ha" / "lär mig".

## Fas D – Skala (vid behov)

- [ ] JobStream-API för realtidsuppdaterade annonser.
- [ ] Kortlivad cache för JobTech-sökningar.
- [ ] Strukturerad loggning, mätvärden och larm.

---

## Föreslagen ordning

1. **Fas A** – ett par dagars infra-arbete; lås beständig databas i EU först (störst risk idag).
2. **Veckosammanfattning** (Fas C) – förvandlar appen från inmatningsyta till påminnelseverktyg.
3. **Kalenderexport** (Fas C) – låg insats, högt upplevt värde.
4. **Städning + E2E** (Fas B) – skydd mot regressioner när trafik kommer.
5. Övriga Fas C/D efter behov och feedback.

## Principer (oförändrade)

1. Användaren äger sin data – export och radering ska förbli uppenbara.
2. Appen ska minska stress, inte lägga till administration.
3. Matchning måste vara förklarbar.
4. Lagra mindre när det går – parsa CV-filer, spara aldrig uppladdningar.
5. Behåll den personliga trackern tills efterfrågan bevisar en annan yta.
