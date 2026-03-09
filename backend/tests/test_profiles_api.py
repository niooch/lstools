import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from transports.models import Route, RouteStatus
from users.models import VerificationDocument, VerificationStatus

User = get_user_model()

USERS_BASE = "/api/users/profiles"
ROUTES_BASE = "/api/transport/routes"


def _approve_docs(user):
    VerificationDocument.objects.create(
        user=user,
        kind="company",
        file=f"verification/{user.pk}-approved.pdf",
        status=VerificationStatus.APPROVED,
    )

def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_me_get_and_patch_profile(auth_client, verified_user):
    # GET /me returns own profile with safe fields
    r = auth_client.get(f"{USERS_BASE}/me")
    assert r.status_code == 200, r.data
    me = r.data
    assert me["id"] == verified_user.id
    assert me["username"] == verified_user.username
    assert "email" in me
    assert "nickname_color" in me and me["nickname_color"].startswith("#")

    # PATCH /me updates editable fields, not username/email
    payload = {
            "display_name": "The Driver",
            "bio": "reliable, night runs ok",
            "phone_number": "+48 600 700 800",
            "username": "should_not_change",
            "email": "nope@example.com",
            }
    r2 = auth_client.patch(f"{USERS_BASE}/me", payload, format="json")
    assert r2.status_code == 200, r2.data
    assert r2.data["display_name"] == "The Driver"
    assert "reliable" in r2.data["bio"]
    assert r2.data["phone_number"] == "+48 600 700 800"
    # read-only unchanged
    assert r2.data["username"] == verified_user.username
    assert r2.data["email"] == verified_user.email


@pytest.mark.django_db
def test_public_profile_view_safe_fields(auth_client):
    # create another user with some private fields filled
    other = User.objects.create_user(
            username="other_user", email="other@example.com", password="x", is_email_verified=True,
            display_name="Other", bio="I haul reefers", phone_number="+48 123 456 789"
            )

    r = auth_client.get(f"{USERS_BASE}/{other.id}")
    assert r.status_code == 200, r.data
    data = r.data
    # public fields
    assert data["id"] == other.id
    assert data["username"] == "other_user"
    assert data["display_name"] == "Other"
    assert "I haul reefers" in (data.get("bio") or "")
    assert data["nickname_color"].startswith("#")
    assert "route_stats" in data and {"active", "sold", "cancelled", "total"} <= set(data["route_stats"].keys())
    # private fields SHOULD NOT be here
    assert "email" not in data
    assert "phone_number" not in data


@pytest.mark.django_db
def test_profiles_require_authentication(api_client, verified_user):
    # Unauthenticated → 401
    r1 = api_client.get(f"{USERS_BASE}/me")
    assert r1.status_code in (401, 403)
    r2 = api_client.get(f"{USERS_BASE}/{verified_user.id}")
    assert r2.status_code in (401, 403)


@pytest.mark.django_db
def test_public_profile_route_stats_counts(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    """
    Create three routes for target user:
      - one active
      - one sold
      - one cancelled
    Then read stats from another user and verify counts.
    """
    # target user
    target = User.objects.create_user(
            username="target", email="t@example.com", password="x", is_email_verified=True
            )
    _approve_docs(target)
    # client as target user
    target_client = APIClient()
    target_client.force_authenticate(user=target)

    def mk(price="100.00"):
        r = target_client.post(
                ROUTES_BASE,
                {
                    "origin": loc_warsaw.id,
                    "destination": loc_wroclaw.id,
                    "time_start": now.isoformat(),
                    "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
                    "vehicle_type": vt_van.id,
                    "price": price,
                    "currency": "PLN",
                    },
                format="json",
                )
        assert r.status_code == 201, r.data
        return r.data["id"]

    r_active = mk("111.00")
    r_sold = mk("222.00")
    r_cancel = mk("333.00")

    # mutate statuses
    s = target_client.post(f"{ROUTES_BASE}/{r_sold}/sell")
    assert s.status_code == 200, s.data
    c = target_client.post(f"{ROUTES_BASE}/{r_cancel}/cancel")
    assert c.status_code == 200, c.data

    # now, from another user, fetch target's public profile and check counts
    resp = auth_client.get(f"{USERS_BASE}/{target.id}")
    assert resp.status_code == 200, resp.data
    stats = resp.data["route_stats"]
    assert stats["active"] >= 1  # at least r_active
    assert stats["sold"] >= 1    # includes r_sold
    assert stats["cancelled"] >= 1  # includes r_cancel
    assert stats["total"] >= 3


@pytest.mark.django_db
def test_routes_list_filter_by_owner(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # Create one route by me
    mine = auth_client.post(
            ROUTES_BASE,
            {
                "origin": loc_warsaw.id,
                "destination": loc_wroclaw.id,
                "time_start": now.isoformat(),
                "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
                "vehicle_type": vt_van.id,
                "price": "100.00",
                "currency": "PLN",
                },
            format="json",
            ).data["id"]

    # Create another route by a different user
    other = User.objects.create_user(
            username="extra", email="extra@example.com", password="x", is_email_verified=True
            )
    _approve_docs(other)
    other_client = APIClient()
    other_client.force_authenticate(user=other)
    other_route = other_client.post(
            ROUTES_BASE,
            {
                "origin": loc_wroclaw.id,
                "destination": loc_warsaw.id,
                "time_start": now.isoformat(),
                "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
                "vehicle_type": vt_van.id,
                "price": "200.00",
                "currency": "PLN",
                },
            format="json",
            ).data["id"]

    # Filter by owner=<other.id> should only show other's active route
    resp = auth_client.get(f"{ROUTES_BASE}?owner={other.id}")
    assert resp.status_code == 200, resp.data
    ids = {x["id"] for x in _results(resp.data)}
    assert other_route in ids and mine not in ids
