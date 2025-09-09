import pytest
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_mine_with_vehicle_type_filter(auth_client, vt_van, vt_reefer, loc_warsaw, loc_wroclaw, now):
    r1 = auth_client.post(
        BASE,
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

    r2 = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_reefer.id,
            "price": "200.00",
            "currency": "PLN",
        },
        format="json",
    ).data["id"]

    mine_reefer = auth_client.get(f"{BASE}/mine?vehicle_type_slug=reefer")
    data = mine_reefer.data["results"] if isinstance(mine_reefer.data, dict) and "results" in mine_reefer.data else mine_reefer.data
    ids = {x["id"] for x in data}
    assert r2 in ids and r1 not in ids

