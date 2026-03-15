import pytest
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_origin_near_filters(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # make two routes: one starting in Warsaw, one starting in Wroclaw
    r1 = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100", "currency": "EUR"
        },
        format="json",
    ).data["id"]

    r2 = auth_client.post(
        BASE,
        {
            "origin": loc_wroclaw.id, "destination": loc_warsaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "200", "currency": "EUR"
        },
        format="json",
    ).data["id"]

    # Search near Warsaw within 5km -> should include r1, not r2
    resp = auth_client.get(f"{BASE}?origin_near=52.2297,21.0122,5")
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    ids = {x["id"] for x in data}
    assert r1 in ids and r2 not in ids

@pytest.mark.django_db
def test_origin_q_with_radius_uses_nominatim(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    # monkeypatch nominatim to return Warsaw coords
    from localisations import services as geo_svc
    monkeypatch.setattr(
        geo_svc, "nominatim_search",
        lambda q, limit=1: [{"lat": "52.229700", "lon": "21.012200"}]
    )

    r_waw = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100", "currency": "EUR"
        },
        format="json",
    ).data["id"]

    r_wro = auth_client.post(
        BASE,
        {
            "origin": loc_wroclaw.id, "destination": loc_warsaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "200", "currency": "EUR"
        },
        format="json",
    ).data["id"]

    # query by place name (origin_q) with small radius -> only the Warsaw-origin route
    resp = auth_client.get(f"{BASE}?origin_q=WRO5&radius_km=10")
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    ids = {x["id"] for x in data}
    assert r_waw in ids and r_wro not in ids

