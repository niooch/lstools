import pytest
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_available_at_inclusive_boundaries(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    start = now + timezone.timedelta(hours=1)
    end   = now + timezone.timedelta(hours=3)

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": start.isoformat(),
            "time_end": end.isoformat(),
            "vehicle_type": vt_van.id,
            "price": "100.00",
            "currency": "EUR",
        },
        format="json",
    )
    rid = r.data["id"]

    # available_at exactly at start → included
    at_start = auth_client.get(f"{BASE}?available_at={start.isoformat()}")
    data1 = at_start.data["results"] if isinstance(at_start.data, dict) and "results" in at_start.data else at_start.data
    ids1 = {x["id"] for x in data1}
    assert rid in ids1

    # available_at exactly at end → included
    at_end = auth_client.get(f"{BASE}?available_at={end.isoformat()}")
    data2 = at_end.data["results"] if isinstance(at_end.data, dict) and "results" in at_end.data else at_end.data
    ids2 = {x["id"] for x in data2}
    assert rid in ids2

