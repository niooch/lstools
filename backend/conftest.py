import pytest
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from localisations.models import Localisation
from transports.models import VehicleType
from users.models import VerificationDocument, VerificationStatus

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def verified_user(db):
    user = User.objects.create_user(
        username="u_verified", email="v@example.com", password="x", is_email_verified=True
    )
    VerificationDocument.objects.create(
        user=user,
        kind="company",
        file="verification/approved.pdf",
        status=VerificationStatus.APPROVED,
    )
    return user

@pytest.fixture
def email_verified_user(db):
    return User.objects.create_user(
        username="u_email_only", email="email-only@example.com", password="x", is_email_verified=True
    )

@pytest.fixture
def unverified_user(db):
    return User.objects.create_user(
        username="u_unverified", email="u@example.com", password="x", is_email_verified=False
    )

@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        username="admin", email="admin@example.com", password="x", is_staff=True, is_email_verified=True
    )

@pytest.fixture
def auth_client(api_client, verified_user):
    api_client.force_authenticate(user=verified_user)
    return api_client

@pytest.fixture
def staff_client(api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    return api_client

@pytest.fixture
def now():
    return timezone.now()

@pytest.fixture
def vt_van(db):
    return VehicleType.objects.create(name="Van", slug="van", category="van", attribute="V", is_active=True)

@pytest.fixture
def vt_reefer(db):
    return VehicleType.objects.create(name="Reefer", slug="reefer", category="reefer", attribute="R", is_active=True)

@pytest.fixture
def loc_warsaw(db, verified_user):
    return Localisation.objects.create(name="Warsaw", latitude=Decimal("52.229700"), longitude=Decimal("21.012200"), created_by=verified_user)

@pytest.fixture
def loc_wroclaw(db, verified_user):
    return Localisation.objects.create(name="Wroclaw", latitude=Decimal("51.107900"), longitude=Decimal("17.038500"), created_by=verified_user)

@pytest.fixture
def loc_stop_1(db, verified_user):
    return Localisation.objects.create(name="StopOne", latitude=Decimal("51.500000"), longitude=Decimal("19.000000"), created_by=verified_user)

@pytest.fixture
def loc_stop_2(db, verified_user):
    return Localisation.objects.create(name="StopTwo", latitude=Decimal("51.800000"), longitude=Decimal("18.000000"), created_by=verified_user)

def ids_from_response(resp):
    data = resp.data
    if isinstance(data, dict) and "results" in data:
        return {item["id"] for item in data["results"]}
    if isinstance(data, list):
        return {item["id"] for item in data}
    return set()
