# af-jobbansokan-api

Django/DRF API for registering verifiable job application events. Applicants
log their applications to job postings, employers manage postings and see
applications to their own organization, and every creation/deletion/disclosure
of application data is recorded in an append-only audit log — groundwork for
letting authorized parties (e.g. A-kassa) verify job seeking activity.

## Quickstart

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows (source .venv/bin/activate on Unix)
pip install -r requirements.txt
python backend/manage.py migrate
python backend/manage.py runserver
```

- Swagger UI: <http://127.0.0.1:8000/api/docs/>
- Health check: <http://127.0.0.1:8000/health/>

Uses SQLite by default. For Postgres, start the dev database with
`docker compose -f infra/docker-compose.yml up -d` and set the `DB_*`
variables (see `.env.example`).

## Tests & linting

```bash
pytest
ruff check .
black --check .
```

## Documentation

- docs/01-vision-scope.md
- docs/02-architecture.md
- docs/03-security-threat-model.md
- docs/04-data-model.md
- docs/05-api-spec.md
- docs/06-gdpr-privacy.md
- docs/07-devops-ci-cd.md
