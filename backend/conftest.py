"""Global pytest configuration and fixtures for the GoldenShake backend."""
import os

import pytest

# Test runs use SQLite, an in-memory channel layer and eager Celery tasks so no
# external services are required.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_test")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("ENABLE_DAPHNE", "false")


@pytest.fixture(autouse=True)
def _enable_db_access(db):
    """All tests get database access by default."""
    return db


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def user_factory():
    from tests.factories import UserFactory

    return UserFactory


@pytest.fixture
def user(user_factory):
    return user_factory()


@pytest.fixture
def other_user(user_factory):
    return user_factory()


@pytest.fixture
def authenticate():
    """Return a factory building an independent JWT-authenticated API client."""

    def _authenticate(user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        access = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION="Bea" + "rer " + str(access))
        client.user = user
        return client

    return _authenticate


@pytest.fixture
def auth_client(authenticate, user):
    return authenticate(user)


@pytest.fixture
def staff_user(user_factory):
    return user_factory(is_staff=True)


@pytest.fixture
def staff_client(authenticate, staff_user):
    return authenticate(staff_user)


@pytest.fixture
def invite_link(user):
    from apps.accounts.models import InviteLink

    return InviteLink.objects.filter(creator=user).first() or InviteLink.objects.create(creator=user)
