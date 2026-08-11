"""Settings used by the pytest suite: SQLite, in-memory channels, eager Celery."""
import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("DJANGO_DEBUG", "true")

from config.settings import *  # noqa: F401,F403  (import after env defaults)

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",  # noqa: F405
        "TEST": {"NAME": BASE_DIR / "test_db.sqlite3"},  # noqa: F405
        "OPTIONS": {"timeout": 20},
    }
}

ALLOWED_HOSTS = ["*"]

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {"anon": "10000/min", "user": "10000/min"},
}

MESSAGE_ENCRYPTION_KEY = ""
SECURE_SSL_REDIRECT = False
