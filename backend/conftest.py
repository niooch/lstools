# conftest.py
import pytest
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from transports.models import VehicleType
from localisations.models import Localisation

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def verified_user(db):
    return User.objects.create_user(
        username="verified", email="verified@example.com",
        password="x", is_email_verified=True
    )

@pytest.fixture
def unverified_user(db):
    return User.objects.create_user(
        username="unverified", email="unverified@example.com",
        password="x", is_email_verified=False
    )

@pytest.fixture
def vt_van(db):
    return VehicleType.objects.create(name="Van", slug="van")

@pytest.fixture
def vt_reefer(db):
    return VehicleType.objects.create(name="Reefer", slug="reefer")

@pytest.fixture
def loc_warsaw(db, verified_user):
    return Localisation.objects.create(
        name="Warsaw", latitude=Decimal("52.229700"), longitude=Decimal("21.012200"),
        created_by=verified_user
    )

@pytest.fixture
def loc_wroclaw(db, verified_user):
    return Localisation.objects.create(
        name="Wroclaw", latitude=Decimal("51.107900"), longitude=Decimal("17.038500"),
        created_by=verified_user
    )

@pytest.fixture
def auth_client(api_client, verified_user):
    api_client.force_authenticate(user=verified_user)
    return api_client

@pytest.fixture
def now():
    return timezone.now()

