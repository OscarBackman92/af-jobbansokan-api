# Deploy: frontend på Vercel, backend på Render

Vercel kör **inte** Django (ingen långlivad process, ingen PostgreSQL).
Upplägget är därför delat:

- **Frontend** (`frontend/`, React/Vite) → Vercel
- **Backend** (`backend/`, Django/DRF + Postgres) → Render (se README)

Vercel proxar `/api`, `/dj-rest-auth` och `/health` vidare till Render
via `frontend/vercel.json`, så webbläsaren ser allt som samma origin —
inga CORS-inställningar behövs, och frontendens relativa anrop fungerar
oförändrat.

## 1. Backend på Render (gör detta först)

Följ README:s deploy-avsnitt (Render → New → Blueprint → välj repot).
När det är klart har du en URL, t.ex. `https://jobbjungeln.onrender.com`.
Verifiera att `https://<din-backend>/health/` svarar `{"status":"ok"}`.

## 2. Peka vercel.json mot backend

Ersätt `YOUR-BACKEND.onrender.com` på de tre raderna i
[frontend/vercel.json](../frontend/vercel.json) med din faktiska
Render-host. Committa och pusha.

## 3. Importera projektet i Vercel

1. vercel.com → **Add New… → Project** → importera GitHub-repot.
2. **Root Directory:** `frontend` (viktigt — annars hittar Vercel inte appen).
3. Framework Preset: **Vite** (auto-detekteras). Build-kommandot blir
   `npm run build` och output-katalogen `dist`.
4. **Deploy.**

Inga miljövariabler behövs i Vercel — backend-URL:en sitter i
`vercel.json`.

## 4. Verifiera

Öppna din `*.vercel.app`-URL och:

- skapa konto / logga in (träffar `/dj-rest-auth/` → Render)
- lägg till en ansökan, ladda upp ett CV (träffar `/api/v1/` → Render)

Om anrop 404:ar: kontrollera att rewrite-URL:erna i `vercel.json` pekar
på rätt host och att backenden svarar på `/health/`.

## Alternativ: allt på Render (enklast)

`render.yaml` bygger redan frontend + backend i en enda tjänst
(Dockerfile + WhiteNoise serverar SPA:n på `/`). Vill du slippa två
plattformar räcker det att deploya blueprinten — då behövs varken Vercel
eller `vercel.json`. Vercel-vägen är värd det främst om du vill ha
Vercels CDN, preview-deploys per pull request och snabbare frontend-
iterationer.

## Varför inte hela appen på Vercel?

Django behöver en process som lever mellan anrop och en riktig databas.
Vercels serverless-funktioner är kortlivade och saknar persistent disk;
att tvinga in Django där (via WSGI-adapter + extern Postgres som Neon)
går men ger kallstarter, krångligare migreringar och ingen vinst jämfört
med Render för en hobby-/MVP-app. Håll backend där den trivs.
