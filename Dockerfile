# Stage 1: build the frontend
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY frontend/ ./
RUN npm run build

# Stage 2: the Django app, serving API + built frontend via WhiteNoise
FROM python:3.14-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist

# collectstatic runs at container start (Render env vars are runtime-only).
RUN useradd --uid 10001 --create-home appuser \
    && mkdir -p backend/staticfiles \
    && chown -R appuser:appuser backend/staticfiles
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "python backend/manage.py collectstatic --no-input && python backend/manage.py migrate --no-input && python backend/manage.py bootstrap && gunicorn config.wsgi:application --chdir backend --bind 0.0.0.0:${PORT:-8000} --workers 2"]
