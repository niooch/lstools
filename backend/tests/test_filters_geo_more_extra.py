import pytest
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_destination_near_filters(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # r1 ends in Wroclaw, r2 ends in Warsaw
    r1 = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "100.00",
            "currency": "EUR",
        },
        format="json",
    ).data["id"]

    r2 = auth_client.post(
        BASE,
        {
            "origin": loc_wroclaw.id,
            "destination": loc_warsaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "200.00",
            "currency": "EUR",
        },
        format="json",
    ).data["id"]

    # Near Wroclaw → should include r1, not r2
    resp = auth_client.get(f"{BASE}?destination_near=51.1079,17.0385,5")
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    ids = {x["id"] for x in data}
    assert r1 in ids and r2 not in ids


@pytest.mark.django_db
def test_destination_q_with_radius_uses_nominatim(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    # Force nominatim result to Wroclaw coords
    from localisations import services as geo_svc
    monkeypatch.setattr(
        geo_svc, "nominatim_search",
        lambda q, limit=1: [{"lat": "51.107900", "lon": "17.038500"}]
    )

    r_wro_dest = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "150.00",
            "currency": "EUR",
        },
        format="json",
    ).data["id"]

    r_waw_dest = auth_client.post(
        BASE,
        {
            "origin": loc_wroclaw.id,
            "destination": loc_warsaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "250.00",
            "currency": "EUR",
        },
        format="json",
    ).data["id"]

    resp = auth_client.get(f"{BASE}?destination_q=WRO5&radius_km=10")
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    ids = {x["id"] for x in data}
    assert r_wro_dest in ids and r_waw_dest not in ids

