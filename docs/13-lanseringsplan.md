# Lanseringsplan – Jobbdjungeln (f.d. Ansökt)

Ny plan beslutad juni 2026, efter att Fas 1–3 i `12-utvecklingsplan.md` i
praktiken är klara. Fokus skiftar från "bygga funktioner" till "göra
appen redo för riktiga användare" och därefter retention.

> **Läge september 2026:** Appen körs på Render Starter i Frankfurt med
> Supabase Postgres (EU) och egen domän
> <https://jobbdjungeln.obackman.se> (SPA: `/app/`). E2E, veckomejl, ICS
> och digest är klara. Kvar som ops-blockerare: verifierad
> avsändardomän i Brevo, uptime-check och backup-rutin.

## Lägesbild

Appen är i drift på <https://jobbdjungeln.obackman.se> och funktionellt
komplett: Översikt, Sparade jobb, Ansökningar, Rapportera, tidslinje,
fri inmatning, live Platsbanken-sök med förklarbar CV-matchning,
e-postverifiering, operatör-ID, Sentry, rate limiting, cron-påminnelser,
sparade sökningar, integritetspolicy, dublettskydd, CSV-export, ICS och
veckosammanfattning. Frontend-tester (Vitest), ESLint, typecheck,
pytest-cov och Playwright körs i CI.

Det är inte längre en prototyp – kvarvarande blockerare är infrastruktur
och juridik, inte saknad funktionalitet.

## Kan den lanseras publikt?

Ja för mjuk delning. Kvarvarande ops-luckor (inte saknad produktfunktion):

| Blockerare | Konsekvens |
|---|---|
| Verifierad avsändardomän | Mejl från `@brevosend.com` kan hamna i skräppost. |
| Uptime-check | Ingen extern övervakning av `/health/`. |
| Dedikerad produktdomän | Nuvarande `jobbdjungeln.obackman.se` fungerar; ett eget `.se` vore tydligare. |
| Postgres-backup utöver Supabase | Behöver dokumenterad restore-övning. |

**Rekommendation:** stanna på Render Frankfurt + Supabase. `render.yaml`
är redan konfigurerad. Verifiera Brevo-domän och lägg uptime-check.

---

## Fas A – Publik lansering (infra/juridik)

- [x] EU-region (Frankfurt) + beständig Postgres (Supabase).
- [ ] Domänverifiering i Brevo + `no-reply@dindomän` som avsändare.
- [x] Egen domän (`jobbdjungeln.obackman.se`).
- [ ] Uptime-check (UptimeRobot eller Render).
- [ ] Rotera den tidigare exponerade Brevo SMTP-nyckeln.
- [ ] Backup-rutin för Postgres.

**Definition of done:** appen kan delas publikt med beständig databas i
EU, fungerande e-post som inte fastnar i skräppost och övervakad uppetid.

## Fas B – Förtroende & städning (parallellt)

- [x] 2–3 E2E-röktester: registrering → tavla → spara annons.
- [x] Ta bort legacy `/api/v1/postings/` + `import_postings`.
- [x] Ta bort oanvänd `/api/v1/applications/stats/`.
- [ ] Google-inloggning i produktion (kod klar, env saknas).
- [ ] XLSX-export vid sidan av CSV.

Se [15-vag-till-fardig-webapp.md](15-vag-till-fardig-webapp.md) för full lista.

## Fas C – Stickiness (retention)

- [x] **Veckosammanfattning** per mejl: skickade ansökningar, förfallna uppföljningar, bokade intervjuer.
- [x] **ICS/kalenderexport** för intervjuer och `next_action_at`.
- [x] **Digest-mejl** för sparade sökningar (nya träffar sedan sist).
- [ ] Föreslå söktermer utifrån CV:t.
- [ ] Märk kompetenser som "måste ha" / "bra att ha" / "lär mig".

## Fas D – Skala (vid behov)

- [ ] JobStream-API för realtidsuppdaterade annonser.
- [x] Kortlivad cache för JobTech-sökningar.
- [ ] Strukturerad loggning, mätvärden och larm.

---

## Föreslagen ordning

1. **Brevo-domän + uptime + backup** (kvarvarande Fas A).
2. **Google-inloggning i prod** när OAuth-klienten finns (Fas B).
3. Övriga Fas C/D efter användarfeedback.

## Principer (oförändrade)

1. Användaren äger sin data – export och radering ska förbli uppenbara.
2. Appen ska minska stress, inte lägga till administration.
3. Matchning måste vara förklarbar.
4. Lagra mindre när det går – parsa CV-filer, spara aldrig uppladdningar.
5. Behåll den personliga trackern tills efterfrågan bevisar en annan yta.
