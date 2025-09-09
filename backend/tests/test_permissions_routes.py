import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

BASE = "/api/transport/routes"
User = get_user_model()

@pytest.mark.django_db
def test_non_owner_cannot_cancel_or_sell(api_client, auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # owner creates a route
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=3)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "300.00",
            "currency": "PLN",
            "crew": "single",
        },
        format="json",
    )
    rid = r.data["id"]

    # another verified user attempts to cancel/sell -> 403
    other = User.objects.create_user(
        username="other", email="other@example.com", password="x", is_email_verified=True
    )
    api_client.force_authenticate(user=other)

    c = api_client.post(f"{BASE}/{rid}/cancel")
    s = api_client.post(f"{BASE}/{rid}/sell", {"price": "350.00"}, format="json")
    assert c.status_code == 403
    assert s.status_code == 403

