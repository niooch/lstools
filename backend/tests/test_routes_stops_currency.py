import pytest
from decimal import Decimal
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_create_route_with_stops_crew_currency(auth_client, loc_warsaw, loc_wroclaw, loc_stop_1, loc_stop_2, vt_van, now, monkeypatch):
    # each leg = 100.00km → total 3 legs (origin -> s1 -> s2 -> dest) = 300.00
    from transports import services as svc
    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("100.00"))

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=8)).isoformat(),
            "vehicle_type": vt_van.id,
            "crew": "double",
            "stop_ids": [loc_stop_1.id, loc_stop_2.id],
            "price": "1200.00",
            "currency": "EUR",
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["crew"] == "double"
    assert r.data["currency"] == "EUR"
    assert r.data["length_km"] == "300.00"
    assert r.data["price"] == "1200.00"
    # price_per_km should include currency, 1200/300 = 4.00
    assert "4.00" in r.data.get("price_per_km", "")
    assert "EUR" in r.data.get("price_per_km", "")
    # stops returned in order
    stops = r.data["stops"]
    assert [s["order"] for s in stops] == [1, 2]
    assert stops[0]["name"] == "StopOne"

@pytest.mark.django_db
def test_stop_limit_enforced(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # 6 stops -> 400
    stop_ids = [101, 102, 103, 104, 105, 106]
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=8)).isoformat(),
            "vehicle_type": vt_van.id,
            "crew": "single",
            "stop_ids": stop_ids,
            "price": "500.00",
            "currency": "EUR",
        },
        format="json",
    )
    assert r.status_code == 400
    assert "stop_ids" in r.data

@pytest.mark.django_db
def test_update_stops_recomputes_length(auth_client, loc_warsaw, loc_wroclaw, loc_stop_1, vt_van, now, monkeypatch):
    from transports import services as svc
    # first: origin->dest (1 leg) = 100; then update to add 1 stop (2 legs) = 200
    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("100.00"))

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=8)).isoformat(),
            "vehicle_type": vt_van.id, "crew": "single", "price": "400.00", "currency": "EUR"
        },
        format="json",
    )
    assert r.status_code == 201
    rid = r.data["id"]
    assert r.data["length_km"] == "100.00"

    r2 = auth_client.patch(f"{BASE}/{rid}", {"stop_ids": [loc_stop_1.id]}, format="json")
    assert r2.status_code == 200, r2.data
    assert r2.data["length_km"] == "200.00"


@pytest.mark.django_db
def test_currency_pln_rejected(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "200.00",
            "currency": "PLN",
        },
        format="json",
    )
    assert r.status_code == 400
    assert "currency" in r.data
