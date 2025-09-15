from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / 'lstoolsApi/.env')

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", 'noreply@lstools.co')


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
#read from djangosecretkey.txt
SECRET_KEY = 'django-insecure-lj$l87&0g$ks7jq=ap96ml95hgspx*in1$%9u=^@hb(2sa3=ch'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = []

APPEND_SLASH = False

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    #third party
    'rest_framework',
    'django_extensions',
    'corsheaders',
    'rest_framework.authtoken',
    'django_filters',
    'drf_spectacular',
    #local
    'api',
    'users',
    'core',
    'localisations',
    'transports',
    'chat',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    'corsheaders.middleware.CorsMiddleware',
]

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5137",
        "http://127.0.0.1:5173",
        ]
CORS_ALLOW_CREDENTIALS = True

CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'transports-cache',
            }
        }

OSRM_CACHE_TTL_SECONDS = int(os.getenv("OSRM_CACHE_TTL_SECONDS", 86400) ) #default 1 day


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.DefaultPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'COERCE_DECIMAL_TO_STRING': True,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
        ],
    'DEFAULT_THROTTLE_RATES': {
        'chat': '30/minute',
        'routes-write': '30/hour',
        },
}

SIMPLE_JWT = {
        'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
        'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
        'AUTH_HEADER_TYPES': ('Bearer',),
        'AUTH_COOKIE': 'access',
        "AUTH_COOKIE_SECURE": False,
        'AUTH_COOKIE_HTTP_ONLY': True,
        "AUTH_COOKIE_SAMESITE": 'Lax',
        }

ROOT_URLCONF = 'lstoolsApi.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'lstoolsApi/templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'lstoolsApi.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'lstools',
        'OPTIONS': {
            'read_default_file': '/home/kogut/projekt/backend/lstoolsApi/mariadb.cnf',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES', default_storage_engine='INNODB'",
        },
        'TEST': {
            'NAME': 'test_lstools',
        },
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

SPECTACULAR_SETTINGS = {
    "TITLE": "LS Tools API",
    "DESCRIPTION": "Logistics routes marketplace API (users, localisations, vehicles, routes).",
    "VERSION": "1.0.0",
    "SERVERS": [
        {"url": "http://127.0.0.1:8000", "description": "Local dev"},
    ],
    "CONTACT": {"name": "Jakub Kogut", "email": "admin@lstool.co"},
    "LICENSE": {"name": "Proprietary"},
    "COMPONENT_SPLIT_REQUEST": True,   # nicer request/response separation
    "SECURITY": [{"bearerAuth": []}],  # use JWT in Swagger “Authorize”
    "AUTHENTICATION_WHITELIST": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        # add any others you use
    ],
    "TAGS": [
        {"name": "Transport", "description": "Vehicle types & routes"},
        {"name": "Localisations", "description": "Geo points catalog"},
        {"name": "Auth", "description": "JWT & email verification"},
        {"name": "Users", "description": "User profile endpoints"},
    ],
}

AUTH_USER_MODEL = 'users.User'


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Europe/Warsaw'

USE_I18N = True

USE_TZ = True

#sciezka do nominatim
NOMINATIM_BASE_URL = os.getenv("NOMINATIM_BASEURL", 'http://localhost:8080')


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
