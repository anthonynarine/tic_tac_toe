# Filename: backend/ttt_core/settings.py


import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from decouple import config

from .logging_conf import julia_fiesta_logs

# Step 1: Initialize logging configuration
julia_fiesta_logs()

# Step 2: Base directory for the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Step 3: Demo mode flag (guard demo endpoints)
DEMO_MODE = config("DEMO_MODE", default=False, cast=bool)
DEMO_PLAYER1_EMAIL = config("DEMO_PLAYER1_EMAIL", default="player1@gmail.com")
DEMO_PLAYER2_EMAIL = config("DEMO_PLAYER2_EMAIL", default="player2@gmail.com")

DEMO_PLAYER1_FIRST_NAME = config("DEMO_PLAYER1_FIRST_NAME", default="player1")
DEMO_PLAYER1_LAST_NAME = config("DEMO_PLAYER1_LAST_NAME", default="player1")

DEMO_PLAYER2_FIRST_NAME = config("DEMO_PLAYER2_FIRST_NAME", default="player2")
DEMO_PLAYER2_LAST_NAME = config("DEMO_PLAYER2_LAST_NAME", default="player2")

# Step 4: Security settings
OPENAI_API_KEY = config("OPENAI_API_KEY")
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "tic-tac-toe-server-66c5e15cb1f1.herokuapp.com",
    "onevone.net",
    "www.onevone.net",
    "gorgeous-pothos-e03300.netlify.app",  # optional for old Netlify URL access
]

# Step 5: Application definition
INSTALLED_APPS = [
    # Django Core Apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-Party Apps
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt",
    "channels",
    "django_extensions",
    # Project-Specific Apps
    "ai_agent",
    "game",
    "friends",
    "chat",
    "invites",
    "notifications",
    "users.apps.UsersConfig",  # Signals
]

MIDDLEWARE = [
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Step 6: CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://onevone.net",
    "https://www.onevone.net",
    "https://gorgeous-pothos-e03300.netlify.app",
]
CORS_ALLOW_CREDENTIALS = True

# Step 7: URL configuration
ROOT_URLCONF = "ttt_core.urls"

# Step 8: Templates configuration
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Step 9: WSGI and ASGI application
WSGI_APPLICATION = "ttt_core.wsgi.application"
ASGI_APPLICATION = "ttt_core.asgi.application"

# Step 10: Database configuration
if os.environ.get("DATABASE_URL"):
    DATABASES = {"default": dj_database_url.config(conn_max_age=600, ssl_require=True)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Step 11: Authentication settings
AUTH_USER_MODEL = "users.CustomUser"

# Step 12: REST Framework configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "demo_login": "20/min",
    },
}

# Step 13: JWT configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=20),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": config("SECRET_KEY"),
    "ALGORITHM": "HS256",
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# Step 14: Static and media files
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Step 15: Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Step 16: Localization settings
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/New_York"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Step 17: CSRF and session cookies
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "https://onevone.net",
    "https://www.onevone.net",
]

if DEBUG:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
else:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"

# Step 18: Redis (Channels + Cache)
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379")
parsed_url = urlparse(REDIS_URL)

# Step 19: Detect SSL based on scheme
# - Local: redis://  -> non-SSL
# - Heroku: rediss:// -> SSL
is_ssl = parsed_url.scheme == "rediss"

# Step 20: Channels Redis config (only include ssl_cert_reqs in SSL mode)
redis_channel_host = {"address": REDIS_URL}
if is_ssl:
    redis_channel_host["ssl_cert_reqs"] = None

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [redis_channel_host]},
    }
}


# Step 21: Cache Redis config (CRITICAL FIX)
# Only pass ssl_cert_reqs when using rediss://
redis_pool_kwargs = {"ssl_cert_reqs": None} if is_ssl else {}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": redis_pool_kwargs, 
        },
    }
}

# Step 22: Staticfiles
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
