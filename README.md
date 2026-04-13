# AF Jobbansökan

Ett fullstack-system för att registrera, spåra och dela verifierbara jobbansökningshändelser. Byggt för Arbetsförmedlingen och kompatibelt med A-kassans verifieringsbehov.

---

## Innehåll

- [Projektöversikt](#projektöversikt)
- [Arkitektur](#arkitektur)
- [Snabbstart](#snabbstart)
- [Backend (Django REST API)](#backend-django-rest-api)
- [Frontend (React)](#frontend-react)
- [API-referens](#api-referens)
- [Testning](#testning)
- [Miljövariabler](#miljövariabler)
- [Dokumentation](#dokumentation)

---

## Projektöversikt

| Del | Teknologi | Port |
|-----|-----------|------|
| Backend API | Django 5.2 + DRF 3.16 | `8000` |
| Frontend | React 19 + Vite + Tailwind CSS | `5173` |
| Databas | PostgreSQL 16 (Docker) | `5433` |

**Roller:**
- **Sökande** — registrerar och spårar jobbansökningar
- **Arbetsgivare** — publicerar platsannonser och hanterar inkomna ansökningar
- **Admin** — administrerar systemet via Django Admin

---

## Arkitektur

```
┌─────────────────┐        ┌─────────────────────────────┐
│   React Frontend │──────▶│        Django REST API       │
│  localhost:5173  │  HTTP  │       localhost:8000         │
│                  │◀──────│                              │
└─────────────────┘  JSON  │  /api/v1/   (core endpoints) │
                           │  /dj-rest-auth/  (JWT auth)  │
                           │  /api/docs/  (Swagger UI)    │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │   PostgreSQL 16  │
                                 │  (Docker) :5433  │
                                 └─────────────────┘
```

---

## Snabbstart

### Krav

- Python 3.12+
- Node.js 20+
- Docker Desktop (för PostgreSQL)

### 1. Klona och installera

```bash
git clone <repo-url>
cd af-jobbansokan-api
```

### 2. Python-miljö

```bash
# Skapa och aktivera virtuell miljö
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

# Installera beroenden
pip install -r requirements.txt
```

### 3. Miljöfil

```bash
cp .env.example .env
# Redigera .env vid behov (se Miljövariabler nedan)
```

### 4a. Starta med PostgreSQL (Docker)

```bash
# Starta databasen
docker compose -f infra/docker-compose.yml up -d

# Kör migreringar
cd backend
python manage.py migrate

# (Valfritt) Skapa superanvändare
python manage.py createsuperuser

# Starta API:t
python manage.py runserver
```

### 4b. Starta med SQLite (ingen Docker)

```bash
cd backend

$env:DB_ENGINE = "django.db.backends.sqlite3"   # PowerShell
$env:DB_NAME   = "db.sqlite3"                   # PowerShell

python manage.py migrate
python manage.py runserver
```

### 5. Starta frontend

```bash
cd frontend
npm install
npm run dev
```

Öppna `http://localhost:5173` i webbläsaren.

---

## Backend (Django REST API)

### Struktur

```
backend/
├── config/
│   ├── settings.py        # Django-inställningar
│   └── urls.py            # Rotnivå URL-routing
└── core/
    ├── models.py          # Databasmodeller
    ├── serializers.py     # DRF-serializers
    ├── views.py           # API-views och viewsets
    ├── permissions.py     # Anpassade behörighetsklasser
    ├── admin.py           # Django Admin-konfiguration
    ├── urls.py            # App-nivå URL-routing
    └── tests/             # Testsvit (40 tester)
```

### Datamodell

```
User (Django inbyggd)
  ├── 1:N ──▶ JobApplication   (owner)
  └── 1:1 ──▶ EmployerProfile  (user)

Organization
  ├── 1:N ──▶ EmployerProfile  (organization)
  └── 1:N ──▶ JobPosting       (organization)

JobPosting
  └── 1:N ──▶ JobApplication   (posting)
```

### Behörighetsmodell

| Endpoint | Anonym | Sökande | Employer (member) | Employer (admin) |
|----------|--------|---------|-------------------|------------------|
| `GET /api/v1/postings/` | ✅ | ✅ | ✅ | ✅ |
| `POST/PATCH/DELETE /api/v1/postings/` | ❌ | ❌ | ❌ | ✅ |
| `GET/POST /api/v1/applications/` | ❌ | ✅ (egna) | ❌ | ❌ |
| `GET /api/v1/employer/applications/` | ❌ | ❌ | ✅ (org) | ✅ (org) |
| `PATCH /api/v1/employer/applications/<id>/` | ❌ | ❌ | ✅ (org) | ✅ (org) |

### Autentisering

JWT-tokens via `dj-rest-auth` + `djangorestframework-simplejwt`:

| Token | Livstid |
|-------|---------|
| Access token | 15 minuter |
| Refresh token | 7 dagar |

Tokens roteras automatiskt vid refresh. Inkludera i varje anrop:

```http
Authorization: Bearer <access_token>
```

### Ansökningsstatusar

| Värde | Beskrivning |
|-------|-------------|
| `applied` | Ansökan skickad (standard) |
| `interview` | Kallad till intervju |
| `offer` | Fått jobberbjudande |
| `rejected` | Nekad |

---

## Frontend (React)

### Struktur

```
frontend/src/
├── api/
│   ├── client.ts          # Axios-instans med JWT + auto-refresh
│   ├── auth.ts            # Login, register, logout, me
│   ├── postings.ts        # Platsannonser
│   └── applications.ts    # Ansökningar (sökande + arbetsgivare)
├── contexts/
│   └── AuthContext.tsx    # Global auth-state
├── components/
│   ├── Navbar.tsx         # Navigationsbar
│   ├── StatusBadge.tsx    # Färgkodad statusindikator
│   └── ProtectedRoute.tsx # Route-guards
└── pages/
    ├── Landing.tsx        # Startsida
    ├── Login.tsx          # Inloggning
    ├── Register.tsx       # Registrering
    ├── Jobs.tsx           # Jobblistning med sökning
    ├── Dashboard.tsx      # Sökandens panel
    └── EmployerDashboard.tsx  # Arbetsgivarens panel
```

### Sidor

| Sida | URL | Åtkomst |
|------|-----|---------|
| Startsida | `/` | Alla |
| Lediga jobb | `/jobs` | Alla (ansökan kräver inloggning) |
| Logga in | `/login` | Alla |
| Registrera | `/register` | Alla |
| Mina ansökningar | `/dashboard` | Inloggad sökande |
| Arbetsgivarpanel | `/employer` | Användare med `EmployerProfile` |

### Teknologier

| Paket | Version | Syfte |
|-------|---------|-------|
| React | 19 | UI-ramverk |
| TypeScript | 6 | Typsäkerhet |
| Vite | 8 | Byggverktyg + dev-server |
| Tailwind CSS | 3 | Styling |
| React Router | 7 | Klientsidig routing |
| TanStack Query | 5 | Server-state och caching |
| Axios | 1 | HTTP-klient |
| React Hook Form | 7 | Formulärhantering |

### Proxy-konfiguration

Vite proxar automatiskt API-anrop till Django under utveckling ([vite.config.ts](frontend/vite.config.ts)):

```
/api       → http://127.0.0.1:8000
/dj-rest-auth → http://127.0.0.1:8000
```

---

## API-referens

Fullständig interaktiv dokumentation finns på:

```
http://127.0.0.1:8000/api/docs/
```

### Autentisering

```http
POST /dj-rest-auth/registration/
Content-Type: application/json

{ "username": "anna", "password1": "Lösenord123!", "password2": "Lösenord123!" }
```

```http
POST /dj-rest-auth/login/
Content-Type: application/json

{ "username": "anna", "password": "Lösenord123!" }

→ { "access": "eyJ...", "refresh": "eyJ..." }
```

### Platsannonser

```http
GET  /api/v1/postings/                  # Lista (publik, paginerad)
GET  /api/v1/postings/?search=python    # Sök på titel/företag/ort
GET  /api/v1/postings/?page=2           # Sida 2
POST /api/v1/postings/                  # Skapa (employer admin)
PATCH /api/v1/postings/<id>/            # Uppdatera (employer admin)
DELETE /api/v1/postings/<id>/           # Ta bort (employer admin)
```

### Jobbansökningar

```http
GET    /api/v1/applications/            # Mina ansökningar (paginerad)
POST   /api/v1/applications/            # Ny ansökan
PATCH  /api/v1/applications/<id>/       # Uppdatera status/datum
DELETE /api/v1/applications/<id>/       # Ta bort

# Body för POST:
{ "posting": 1, "applied_at": "2024-03-15" }

# Body för PATCH:
{ "status": "interview" }
```

### Arbetsgivare

```http
GET   /api/v1/employer/applications/           # Alla ansökningar (orgscoped)
GET   /api/v1/employer/applications/?status=applied  # Filtrera på status
PATCH /api/v1/employer/applications/<id>/      # Uppdatera kandidatens status
```

### Övrigt

```http
GET /health/        → { "status": "ok" }
GET /api/v1/me/     → { "id", "username", "email", "is_employer", "employer_role" }
GET /admin/         → Django Admin (superanvändare)
```

---

## Testning

```bash
# Kör hela testsviten (kräver ej Docker – använder SQLite i minnet)
DB_ENGINE=django.db.backends.sqlite3 DB_NAME=":memory:" python -m pytest backend/ -v

# Kör specifik testfil
DB_ENGINE=django.db.backends.sqlite3 DB_NAME=":memory:" python -m pytest backend/core/tests/test_permissions.py -v
```

### Teststruktur (40 tester)

| Fil | Testar |
|-----|--------|
| `test_health.py` | Hälsoendpoint |
| `test_me.py` | `/me/` – autentisering och employer-info |
| `test_applications.py` | CRUD, validering, paginering, sökning |
| `test_postings.py` | CRUD, rollbehörigheter, sökning, paginering |
| `test_employer.py` | Employer-endpoints, org-scope, statusuppdatering |
| `test_permissions.py` | Alla behörighetsregler och valideringsfel |

### Kodkvalitet

```bash
# Linting
ruff check .

# Formatering
black --check .

# Automatisk formatering
black .
```

---

## Miljövariabler

Kopiera `.env.example` till `.env` och anpassa:

```env
# Django
DJANGO_DEBUG=1
DJANGO_SECRET_KEY=byt-ut-i-produktion
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

# Databas (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=afapi_dev
DB_USER=afapi
DB_PASSWORD=afapi
DB_HOST=127.0.0.1
DB_PORT=5433

# Databas (SQLite – för lokal utveckling utan Docker)
# DB_ENGINE=django.db.backends.sqlite3
# DB_NAME=db.sqlite3
```

---

## Skapa en arbetsgivare

Via Django Admin (`http://127.0.0.1:8000/admin/`) eller Django shell:

```bash
python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from core.models import Organization, EmployerProfile

User = get_user_model()
org  = Organization.objects.create(name="Mitt AB", org_number="556000-0001")
user = User.objects.create_user(username="arbetsgivare", password="Lösenord123!")
EmployerProfile.objects.create(user=user, organization=org, role="admin")
```

---

## CI/CD

GitHub Actions kör automatiskt vid pull requests mot `main`:

1. Ruff-linting
2. Black-formateringskontroll  
3. Pytest (40 tester)

Se [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Dokumentation

| Fil | Innehåll |
|-----|----------|
| [docs/01-vision-scope.md](docs/01-vision-scope.md) | Problemformulering och MVP-scope |
| [docs/02-architecture.md](docs/02-architecture.md) | Systemarkitektur |
| [docs/03-security-threat-model.md](docs/03-security-threat-model.md) | Säkerhetshot och åtgärder |
| [docs/04-data-model.md](docs/04-data-model.md) | Datamodell |
| [docs/05-api-spec.md](docs/05-api-spec.md) | API-specifikation |
| [docs/06-gdpr-privacy.md](docs/06-gdpr-privacy.md) | GDPR och integritet |
| [docs/07-devops-ci-cd.md](docs/07-devops-ci-cd.md) | DevOps och CI/CD |

---

## Backlog (planerade funktioner)

- [ ] BankID/eID-autentisering
- [ ] Partner-API för A-kassa (mTLS + OAuth2)
- [ ] Audit-loggning (skapande och utlämning)
- [ ] Dataexport (CSV/XLSX) för sökande
- [ ] CORS-konfiguration för produktionsmiljö
- [ ] Samtyckesmodell för datadelning
