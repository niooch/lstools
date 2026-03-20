import pytest
from decimal import Decimal
from django.utils import timezone

BASE = "/api/transport/routes"
SUGGEST = "/api/transport/routes/suggest-distance"


@pytest.mark.django_db
def test_create_route_accepts_manual_length_km(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    from transports import services as svc

    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("100.00"))

    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=4)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "400.00",
            "currency": "EUR",
            "length_km": "555.50",
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["length_km"] == "555.50"


@pytest.mark.django_db
def test_suggest_distance_returns_sum_for_route_points(
    auth_client,
    loc_warsaw,
    loc_wroclaw,
    loc_stop_1,
    monkeypatch,
):
    from transports import services as svc

    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("50.25"))

    r = auth_client.post(
        SUGGEST,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "stop_ids": [loc_stop_1.id],
        },
        format="json",
    )
    assert r.status_code == 200, r.data
    assert r.data["length_km"] == "100.50"


@pytest.mark.django_db
def test_patch_keeps_manual_length_when_points_unchanged(
    auth_client,
    loc_warsaw,
    loc_wroclaw,
    vt_van,
    now,
    monkeypatch,
):
    from transports import services as svc

    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("80.00"))

    created = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": (now + timezone.timedelta(hours=4)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "400.00",
            "currency": "EUR",
            "length_km": "321.00",
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    rid = created.data["id"]
    assert created.data["length_km"] == "321.00"

    # even if service value changes, non-point updates should preserve manual length_km
    monkeypatch.setattr(svc, "distance_km_cached", lambda *a, **k: Decimal("999.00"))

    patched = auth_client.patch(
        f"{BASE}/{rid}",
        {"price": "450.00"},
        format="json",
    )
    assert patched.status_code == 200, patched.data
    assert patched.data["length_km"] == "321.00"
    assert patched.data["price"] == "450.00"
