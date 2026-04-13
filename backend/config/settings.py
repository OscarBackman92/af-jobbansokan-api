"""
Django settings for af-jobbansokan-api.

Environment variables control all secrets and environment-specific behaviour.
Never commit real credentials — use .env (see .env.example).
"""

from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths & Environment
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
load_dotenv(BASE_DIR.parent / ".env")

# ---------------------------------------------------------------------------
# Core settings
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")

# Reject requests with suspicious Host headers
USE_X_FORWARDED_HOST = False

# Fail fast in production if the default insecure key is used
_IS_TEST = "pytest" in sys.modules or "test" in sys.argv
if not DEBUG and not _IS_TEST and SECRET_KEY == "dev-insecure-secret-key":
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set to a strong random value in production."
    )

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Security
    "corsheaders",
    "axes",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "rest_framework_simplejwt.token_blacklist",
    # Local apps
    "core",
]

MIDDLEWARE = [
    # Security headers — must be first
    "django.middleware.security.SecurityMiddleware",
    # CORS — must be before CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # django-axes brute-force protection — after AuthenticationMiddleware
    "axes.middleware.AxesMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
        "USER": os.getenv("DB_USER", ""),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", ""),
        "PORT": os.getenv("DB_PORT", ""),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        } if os.getenv("DB_ENGINE", "").endswith("postgresql") else {},
    }
}

# django-axes backend (must be listed after ModelBackend)
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "sv-se"
TIME_ZONE = "Europe/Stockholm"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Security headers (production)
# ---------------------------------------------------------------------------

# Clickjacking protection
X_FRAME_OPTIONS = "DENY"

# Prevent MIME-type sniffing
SECURE_CONTENT_TYPE_NOSNIFF = True

# XSS filter in older browsers
SECURE_BROWSER_XSS_FILTER = True

# Referrer-Policy
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# HTTPS enforcement (only in production — controlled by env var)
_HTTPS = os.getenv("DJANGO_HTTPS", "0") == "1"
SECURE_SSL_REDIRECT = _HTTPS
SECURE_HSTS_SECONDS = 31_536_000 if _HTTPS else 0   # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = _HTTPS
SECURE_HSTS_PRELOAD = _HTTPS
SESSION_COOKIE_SECURE = _HTTPS
CSRF_COOKIE_SECURE = _HTTPS
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# Only allow credentials (cookies/auth) from trusted origins
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]

CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "x-csrftoken",
    "x-requested-with",
]

# ---------------------------------------------------------------------------
# DRF + OpenAPI
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/hour",
        "user": "500/day",
        "auth": "10/minute",      # Login / registration endpoints
        "burst": "60/minute",     # Short burst limit
    },
    # Return 429 instead of 403 for throttled requests
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "AF Jobbansökan API",
    "DESCRIPTION": (
        "API för att registrera och dela verifierbara jobbansökningshändelser. "
        "Byggt för Arbetsförmedlingen — kompatibelt med A-kassans verifieringsbehov."
    ),
    "VERSION": "1.0.0",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
}

# ---------------------------------------------------------------------------
# Auth (dj-rest-auth + SimpleJWT)
# ---------------------------------------------------------------------------

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_COOKIE": None,
    "JWT_AUTH_REFRESH_COOKIE": None,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    # Prevent token reuse after rotation
    "TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainPairSerializer",
}

# ---------------------------------------------------------------------------
# allauth
# ---------------------------------------------------------------------------

SITE_ID = 1
ACCOUNT_AUTHENTICATION_METHOD = "username"
ACCOUNT_EMAIL_REQUIRED = False
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_LOGIN_ATTEMPTS_LIMIT = 5
ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT = 300  # 5 minutes

# ---------------------------------------------------------------------------
# django-axes (brute-force protection)
# ---------------------------------------------------------------------------

AXES_ENABLED = True
AXES_FAILURE_LIMIT = 5           # Lock after 5 consecutive failures
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_PARAMETERS = ["ip_address", "username"]  # Track both IP and username
AXES_RESET_ON_SUCCESS = True      # Reset counter on successful login
AXES_NEVER_LOCKOUT_WHITELIST = False
AXES_LOCKOUT_CALLABLE = None      # Default: return 403 on lockout
AXES_ENABLE_ADMIN = True          # Show locked access attempts in admin
AXES_VERBOSE = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django.security": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "axes": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "core": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
