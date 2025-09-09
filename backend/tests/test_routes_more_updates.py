import pytest
from decimal import Decimal
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_remove_stops_recomputes_length(auth_client, loc_warsaw, loc_wroclaw, loc_stop_1, vt_van, now, monkeypatch):
    from transports import services as svc
    # each leg 100. Initially: origin->stop->dest = 2 legs (200). Remove stop => 1 leg (100)
    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("100.00"))

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=6)).isoformat(),
            "vehicle_type": vt_van.id, "crew": "single",
            "stop_ids": [loc_stop_1.id],
            "price": "400.00", "currency": "PLN",
        },
        format="json",
    )
    assert r.status_code == 201
    rid = r.data["id"]
    assert r.data["length_km"] == "200.00"

    # remove stops
    r2 = auth_client.patch(f"{BASE}/{rid}", {"stop_ids": []}, format="json")
    assert r2.status_code == 200
    assert r2.data["length_km"] == "100.00"

@pytest.mark.django_db
def test_invalid_crew_value_returns_400(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "crew": "triple",  # invalid
            "price": "100.00", "currency": "PLN",
        },
        format="json",
    )
    assert r.status_code == 400
    assert "crew" in r.data

@pytest.mark.django_db
def test_invalid_stop_id_returns_400(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "stop_ids": [999999],  # not found
            "price": "100.00", "currency": "PLN",
        },
        format="json",
    )
    assert r.status_code == 400
    assert "stop_ids" in r.data

@pytest.mark.django_db
def test_price_per_km_rounding_string(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    from transports import services as svc
    # length 3.333... (mocked): 10 / 3.33 = 3.00 after rounding, and comes back as string + currency
    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("3.33"))

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "10.00", "currency": "EUR",
        },
        format="json",
    )
    assert r.status_code == 201
    ppk = r.data.get("price_per_km") or ""
    assert "3.00" in ppk and "EUR" in ppk

