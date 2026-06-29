# Pivot: Ansökt — en personlig ansökningstracker

*Beslutad 2026-06-12. Ersätter vision och scope i docs/01 samt
A-kassa/arbetsgivar-flödena i docs/02–09 där de står i konflikt.*

## Varför

Den ursprungliga idén (verifierbara ansökningshändelser för A-kassa-
verifiering) krävde tre parter — arbetssökande, arbetsgivare och
A-kassor — innan produkten gav värde. Pivoten byter till ett behov som
finns hos en enda användare från dag ett: folk bygger egna Excel-ark för
att hålla koll på sina jobbansökningar, med kolumner för status, datum,
kontaktperson och nästa steg. **Ansökt är det arket, fast bättre.**

## Produkten

- **Tavlan** — kanban över aktiva ansökningar: Sparad → Ansökt →
  Telefonintervju → Intervju → Skickad vidare → Erbjudande. Avslutade
  (Accepterat / Avslag / Inget svar / Återkallad) samlas i ett arkiv.
- **Tidslinje per ansökan** — anteckningar, samtal och intervjuer;
  statusbyten loggas automatiskt.
- **Fri inmatning** — företag/roll som text, så alla ansökningar kan
  spåras oavsett var annonsen fanns (LinkedIn, mail, tips).
- **Annonssök** — annonser importeras från Arbetsförmedlingens öppna
  JobTech JobSearch-API och kan läggas direkt på tavlan; CV-matchningen
  (kompetens mot annonstext) behålls som differentierare.
- **CSV-export** — datan är användarens; export speglar Excel-arvet.

## Annonskälla: JobTech (Arbetsförmedlingen)

- `https://jobsearch.api.jobtechdev.se/search` — öppet, gratis, ingen
  API-nyckel. Täcker Platsbanken (~hela svenska annonsmarknaden i en
  källa). Import via `manage.py import_postings`.
- LinkedIn/Indeed har inga fria annons-API:er och förbjuder skrapning —
  de täcks av fri inmatning i stället.
- Framtid: JobStream-API:t (samma huvudman) för realtidsuppdateringar.

## Juridik (GDPR m.m.)

- **Personuppgifter som behandlas:** kontouppgifter, ansökningshistorik,
  anteckningar samt kontaktpersoner hos arbetsgivare (tredje persons
  namn/mail — informera i integritetspolicyn, minimera, radera med
  kontot). Inga särskilda kategorier; ingen myndighetsroll, inget
  tillstånd krävs. Rättslig grund: avtal (tjänsten) för kontodata,
  och användarens eget berättigade intresse för anteckningarna.
- **Rättigheter:** radering = kontoradering (kaskad, finns); tillgång/
  portabilitet = CSV-exporten. Skriv en kort integritetspolicy före
  publik lansering.
- **Cookies/LEK:** endast JWT i localStorage (nödvändig funktion) — ingen
  cookie-banner behövs så länge ingen tredjepartsanalys läggs in.
- **Hosting:** föredra EU-region (Render: Frankfurt) före lansering.
- **Annonsdata:** Arbetsförmedlingens öppna data är fri att använda.
- Borttaget i pivoten: BankID/personnummer (pseudonymiserade hashar),
  partnerutlämningar och auditloggen — datan som motiverade dem finns
  inte längre i systemet.

## Teknik — vad som behölls respektive togs bort

| Behölls | Togs bort |
| --- | --- |
| Django/DRF, JWT via dj-rest-auth | BankID-mock, identity-hashning |
| `JobPosting` + JobTech-import | `Organization`, `EmployerProfile` |
| `JobApplication` (nu redigerbar, rik status) | `PartnerClient`, partner-API |
| `Resume` + matchning | `Favorite`, `AuditLog` (immutabilitetskravet föll) |
| React/Vite-frontend, designsystemet | Employer-/Partner-panelerna |

Nytt: `ApplicationEvent` (tidslinjen), statusflödet, `stats`- och
`events`-endpoints, kanban-UI. Migrationerna är nollställda (0001) —
gammal databas droppas vid deploy.
