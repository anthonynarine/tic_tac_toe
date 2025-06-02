import os
import dj_database_url 
from django_redis import get_redis_connection
from datetime import timedelta
from pathlib import Path
from decouple import config
from urllib.parse import urlparse

from .logging_conf import julia_fiesta_logs

# Initialize logging configuration
julia_fiesta_logs()

# Base directory for the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Security settings
OPENAI_API_KEY = config("OPENAI_API_KEY")
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'tic-tac-toe-server-66c5e15cb1f1.herokuapp.com',
    'onevone.net',
    'www.onevone.net',
    'gorgeous-pothos-e03300.netlify.app',  # optional for old Netlify URL access
]

# Application definition
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

# CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://onevone.net",
    "https://www.onevone.net",
    "https://gorgeous-pothos-e03300.netlify.app",
]

CORS_ALLOW_CREDENTIALS = True  # Allow credentials (cookies) in cross-origin requests

# URL configuration
ROOT_URLCONF = "ttt_core.urls"

# Templates configuration
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

# WSGI and ASGI application
WSGI_APPLICATION = "ttt_core.wsgi.application"
ASGI_APPLICATION = "ttt_core.asgi.application"

# Database configuration
if os.environ.get("DATABASE_URL"):
    DATABASES = {
        'default': dj_database_url.config(conn_max_age=600, ssl_require=True)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / "db.sqlite3",
        }
    }

# Authentication settings
AUTH_USER_MODEL = "users.CustomUser"


# REST Framework configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

# JWT configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),  # Token lifetime
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),    # Refresh token lifetime
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'SIGNING_KEY': config('SECRET_KEY'),           # Ensure the signing key is secure
    'ALGORITHM': 'HS256',                          # Default algorithm
}

# Static and media files
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Localization settings
LANGUAGE_CODE = "en-us"
TIME_ZONE = 'America/New_York'
USE_I18N = True
USE_L10N = True
USE_TZ = True

# CSRF and session cookies
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'https://onevone.net',
    'https://www.onevone.net',
]

if DEBUG:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SAMESITE = 'Lax'
else:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'


REDIS_URL = config("REDIS_URL", default="redis://localhost:6379")
parsed_url = urlparse(REDIS_URL)

# Detect SSL based on scheme
is_ssl = parsed_url.scheme == "rediss"

# Conditional Redis config
redis_config = {
    "address": REDIS_URL,
}
if is_ssl:
    redis_config["ssl_cert_reqs"] = None  # Only apply in production

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [redis_config],
        },
    },
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": {
                "ssl_cert_reqs": None if is_ssl else "required"
            }
        }
    }
}


STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
