import pytest
from django.utils import timezone
from decimal import Decimal

BASE = "/api/transport/routes/stats/me"

@pytest.mark.django_db
def test_my_stats_basic(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # two routes to average
    auth_client.post("/api/transport/routes", {
        "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
        "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
        "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"
    }, format="json")
    auth_client.post("/api/transport/routes", {
        "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
        "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
        "vehicle_type": vt_van.id, "price": "200.00", "currency": "EUR"
    }, format="json")

    s = auth_client.get(BASE)
    assert s.status_code == 200
    assert "lifetime" in s.data and "total" in s.data["lifetime"]

