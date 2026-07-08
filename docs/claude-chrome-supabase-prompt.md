# Claude in Chrome — Supabase-uppsättning för Jobbsöket

Kopiera hela prompten i rutan **“Kopiera prompten”** nedan och klistra in i
Claude in Chrome. Ha **supabase.com** och **dashboard.render.com** tillgängliga
(i samma eller separata flikar).

## Innan du startar

1. Logga in på [Supabase](https://supabase.com) och [Render](https://dashboard.render.com).
2. Ha **Render Postgres connection string** redo (Dashboard → **ansokt-db** →
   **Connect** → **External Database URL**). Klistra **aldrig** lösenord i
   chatten — fyll i själv när Claude ber dig.
3. **Terminal** behövs för `pg_dump` / `pg_restore` (Claude kan guida; du kör
   kommandona lokalt).
4. Planera **5–15 minuters nedtid** under databasbytet (sätt `DATABASE_URL`
   först när importen är klar).

---

## Kopiera prompten

```
Du hjälper mig flytta Jobbsökets produktionsdatabas från Render Postgres till Supabase (EU). Appen är Django på Render (tjänsten **ansokt**), region Frankfurt. Databasen används bara som Postgres — vi använder INTE Supabase Auth eller Storage.

## Regler
- Be mig aldrig klistra in fullständiga lösenord eller API-nycklar i chatten. Säg var jag ska klistra in dem (Render env, Supabase dashboard, terminal).
- Efter varje steg: bekräfta vad jag ser och markera ✅ KLART, ⚠️ DELVIS eller ❌ BLOCKERAT.
- Om något steg kräver terminal (pg_dump/pg_restore), ge exakta kommandon för Windows PowerShell och förklara vad som ska hända.
- Avsluta med en checklista: vad som återstår, hur jag verifierar, och när det är säkert att ta bort Render Postgres.

## Målbild
- Supabase-projekt i **EU** (Frankfurt / eu-central-1 eller närmaste EU-region).
- `DATABASE_URL` på Render-webbtjänsten **jobbjungeln** pekar på Supabase Session pooler (port **5432**).
- Cron-jobb **ansokt-reminders**, **ansokt-prune** och **ansokt-weekly-summary** ärver `DATABASE_URL` från web om blueprint länkar dem.
- All befintlig data migrerad; appen fungerar på https://jobbjungeln.onrender.com/app/

---

# DEL 1 — Skapa Supabase-projekt

Gå igenom steg för steg i Supabase Dashboard:

1. **New project**
   - Organisation: [låt mig välja]
   - **Region:** EU (välj Frankfurt / Central EU om tillgängligt)
   - **Database password:** [jag sätter ett starkt lösenord själv — be mig spara det i lösenordshanterare]
   - Vänta tills projektet är **Active / Healthy**

2. **Project Settings → Database**
   - Notera **Project ref** och host
   - Under **Connection string** → flik **URI**
   - Välj **Session pooler** (inte Transaction) och port **5432**
   - URI ska likna:
     `postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   - Bekräfta att `?sslmode=require` finns (lägg till om det saknas)

3. **Database → Extensions** (valfritt kontroll)
   - Django behöver inga speciella extensions för denna app; hoppa om inget krävs.

Markera DEL 1 som klar när jag har en fungerande Session pooler URI.

---

# DEL 2 — Exportera från Render Postgres

1. Render Dashboard → **ansokt-db** → **Connect** → kopiera **External Database URL**
   (jag klistrar den bara i terminalen, inte i chatten).

2. Ge mig PowerShell-kommandon:
   ```powershell
   # Ersätt <RENDER_DATABASE_URL> med min Render-URL (i citattecken)
   pg_dump "<RENDER_DATABASE_URL>" --no-owner --no-acl -F c -f ansokt.dump
   ```
   - Om `pg_dump` saknas: föreslå `winget install PostgreSQL.PostgreSQL` eller Docker-alternativ.

3. Förväntat resultat: filen `ansokt.dump` skapas utan fel.

---

# DEL 3 — Importera till Supabase

1. Ge mig PowerShell-kommando:
   ```powershell
   # Ersätt <SUPABASE_DATABASE_URL> med Session pooler URI (?sslmode=require)
   pg_restore -d "<SUPABASE_DATABASE_URL>" --no-owner --no-acl --clean --if-exists ansokt.dump
   ```
   - Förklara att `--clean` droppar befintliga objekt i Supabase (OK på ny databas).
   - Varningar om "already exists" kan vara OK; riktiga ERROR ska felsökas.

2. Alternativ om pg_restore strular: föreslå Supabase SQL Editor + `psql` med plain SQL-dump.

---

# DEL 4 — Uppdatera Render

1. Render → **jobbjungeln** (web service) → **Environment**
   - Sätt **DATABASE_URL** = Supabase Session pooler URI (med `sslmode=require`)
   - Spara → **Manual Deploy** eller vänta på auto-deploy

2. Kontrollera cron-jobb:
   - **ansokt-reminders**, **ansokt-prune** och **ansokt-weekly-summary** → Environment
   - `DATABASE_URL` ska **ärvda** från web (fromService) eller ha samma värde

3. Efter deploy: öppna `https://jobbjungeln.onrender.com/health/` — ska returnera `{"status":"ok",...}`

---

# DEL 5 — Verifiera appen

Be mig testa (jag rapporterar resultat):

- [ ] `https://jobbjungeln.onrender.com/health/` → status ok
- [ ] Logga in på `/app/` med befintligt konto
- [ ] Tavlan visar tidigare ansökningar (data migrerad)
- [ ] Skapa en testansökan och ladda om sidan — den finns kvar
- [ ] (Valfritt) Render → cron → **Trigger Run** på reminders — inget databasfel i loggen

---

# DEL 6 — Städa upp (först när DEL 5 är OK)

1. Render → **ansokt-db** → **Suspend** eller **Delete** (sparar pengar)
2. Spara Supabase database password och URI i lösenordshanterare
3. Supabase → **Settings → Database → Backups** — bekräfta att backup-policy räcker

---

## Rapportformat

Avsluta med:

### Sammanfattning
- Vad som gjordes
- Supabase-projekt (namn + region, utan lösenord)
- Eventuella problem

### Kvar att göra
- [ ] …

### Rollback (om något gick fel)
- Sätt tillbaka `DATABASE_URL` till Render Postgres tills Supabase är verifierad
```

---

## Efter migreringen

- Uppdatera teamets lösenordshanterare med Supabase database password.
- Render Postgres kan tas bort först när produktion verifierats i minst en dag.
- Lokalt utvecklingsläge påverkas inte (`DB_*` i `.env` + Docker Compose).
