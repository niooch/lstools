# tests/test_routes.py
import pytest
from decimal import Decimal
from django.utils import timezone
from django.core.cache import cache
from unittest.mock import patch

from transports.models import Route

BASE = "/api/transport/routes"

def _payload(origin_id, dest_id, vt_id, start, end, price=None):
    data = {
        "origin": origin_id,
        "destination": dest_id,
        "time_start": start.isoformat(),
        "time_end": end.isoformat(),
        "vehicle_type": vt_id,
    }
    if price is not None:
        data["price"] = str(price)
    return data

# --- permissions -------------------------------------------------------------

@pytest.mark.django_db
def test_unverified_cannot_create_route(api_client, unverified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    api_client.force_authenticate(user=unverified_user)
    r = api_client.post(
        BASE,
        _payload(loc_warsaw.id, loc_wroclaw.id, vt_van.id, now, now + timezone.timedelta(hours=4)),
        format="json",
    )
    assert r.status_code == 403
    assert "Email not verified" in r.data["detail"]

@pytest.mark.django_db
def test_verified_can_create_and_price_per_km(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    # Make distance a stable 100.00 km so price_per_km is predictable
    from transports import services as svc
    monkeypatch.setattr(svc, "distance_km_cached", lambda *args, **kw: Decimal("100.00"))

    r = auth_client.post(
        BASE,
        _payload(loc_warsaw.id, loc_wroclaw.id, vt_van.id, now, now + timezone.timedelta(hours=5), pay=Decimal("400.00")),
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["length_km"] == "100.00"
    assert r.data["price"] == "400.00"
    assert r.data["price_per_km"] == "4.00"

# --- OSRM caching ------------------------------------------------------------

@pytest.mark.django_db
def test_distance_cached_for_same_pair(auth_client, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    cache.clear()
    calls = {"n": 0}

    def fake_osrm(*args, **kwargs):
        calls["n"] += 1
        return Decimal("123.45")

    # patch only the low-level OSRM call; keep the cache wrapper intact
    with patch("transports.services.osrm_distance_km", side_effect=fake_osrm):
        p1 = _payload(loc_warsaw.id, loc_wroclaw.id, vt_van.id, now, now + timezone.timedelta(hours=2))
        p2 = _payload(loc_warsaw.id, loc_wroclaw.id, vt_van.id, now + timezone.timedelta(days=1), now + timezone.timedelta(days=1, hours=2))
        r1 = auth_client.post(BASE, p1, format="json")
        r2 = auth_client.post(BASE, p2, format="json")

    assert r1.status_code == 201
    assert r2.status_code == 201
    # OSRM should be hit only once; second route reuses cached distance
    assert calls["n"] == 1
    assert r1.data["length_km"] == "123.45"
    assert r2.data["length_km"] == "123.45"

# --- datetime windows & point-in-time ---------------------------------------

@pytest.mark.django_db
def test_datetime_window_filters(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # create three routes directly (skip serializer distance calc)
    r1 = Route.objects.create(
        owner=verified_user, origin=loc_warsaw, destination=loc_wroclaw,
        time_start=now.replace(hour=8, minute=0), time_end=now.replace(hour=18, minute=0),
        vehicle_type=vt_van, length_km=Decimal("10.00")
    )
    r2 = Route.objects.create(
        owner=verified_user, origin=loc_wroclaw, destination=loc_warsaw,
        time_start=now + timezone.timedelta(days=2, hours=9),
        time_end=now + timezone.timedelta(days=3, hours=17),
        vehicle_type=vt_van, length_km=Decimal("20.00")
    )
    r3 = Route.objects.create(
        owner=verified_user, origin=loc_wroclaw, destination=loc_warsaw,
        time_start=now + timezone.timedelta(days=10, hours=9),
        time_end=now + timezone.timedelta(days=10, hours=11),
        vehicle_type=vt_van, length_km=Decimal("30.00")
    )

    # Overlap: [now 12:00, now+1d 00:00] hits r1 only
    dt_from = now.replace(hour=12, minute=0, second=0, microsecond=0)
    dt_to   = (now + timezone.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    resp = auth_client.get(f"{BASE}?dt_from={dt_from.isoformat()}&dt_to={dt_to.isoformat()}")
    ids = {x["id"] for x in resp.data["results"]} if isinstance(resp.data, dict) and "results" in resp.data else {x["id"] for x in resp.data}
    assert r1.id in ids and r2.id not in ids and r3.id not in ids

    # Point-in-time inside r2
    pti = (now + timezone.timedelta(days=2)).replace(hour=12, minute=0, second=0, microsecond=0)
    resp2 = auth_client.get(f"{BASE}?available_at={pti.isoformat()}")
    ids2 = {x["id"] for x in resp2.data["results"]} if isinstance(resp2.data, dict) and "results" in resp2.data else {x["id"] for x in resp2.data}
    assert r2.id in ids2 and r1.id not in ids2 and r3.id not in ids2

# --- proximity (coords + Nominatim name) ------------------------------------

@pytest.mark.django_db
def test_origin_near_filter(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    r_waw = Route.objects.create(
        owner=verified_user, origin=loc_warsaw, destination=loc_wroclaw,
        time_start=now, time_end=now + timezone.timedelta(hours=5),
        vehicle_type=vt_van, length_km=Decimal("10.00")
    )
    r_wro = Route.objects.create(
        owner=verified_user, origin=loc_wroclaw, destination=loc_warsaw,
        time_start=now, time_end=now + timezone.timedelta(hours=5),
        vehicle_type=vt_van, length_km=Decimal("10.00")
    )
    # within 15km of Warsaw center should include r_waw, exclude r_wro
    resp = auth_client.get(f"{BASE}?origin_near=52.2297,21.0122,15")
    ids = {x["id"] for x in resp.data["results"]} if isinstance(resp.data, dict) and "results" in resp.data else {x["id"] for x in resp.data}
    assert r_waw.id in ids and r_wro.id not in ids

@pytest.mark.django_db
def test_origin_q_uses_nominatim(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now, monkeypatch):
    # patch localisations.services.nominatim_search to avoid network
    from localisations import services as geo_svc
    monkeypatch.setattr(geo_svc, "nominatim_search", lambda q, limit=10: [{"lat": "52.229700", "lon": "21.012200"}])

    r_waw = Route.objects.create(
        owner=verified_user, origin=loc_warsaw, destination=loc_wroclaw,
        time_start=now, time_end=now + timezone.timedelta(hours=3),
        vehicle_type=vt_van, length_km=Decimal("10.00")
    )
    resp = auth_client.get(f"{BASE}?origin_q=WRO5%20amazon%20warehouse&radius_km=20")
    ids = {x["id"] for x in resp.data["results"]} if isinstance(resp.data, dict) and "results" in resp.data else {x["id"] for x in resp.data}
    assert r_waw.id in ids

# --- vehicle type filter -----------------------------------------------------

@pytest.mark.django_db
def test_vehicle_type_slug_filter(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, vt_reefer, now):
    r1 = Route.objects.create(
        owner=verified_user, origin=loc_warsaw, destination=loc_wroclaw,
        time_start=now, time_end=now + timezone.timedelta(hours=4),
        vehicle_type=vt_van, length_km=Decimal("10.00")
    )
    r2 = Route.objects.create(
        owner=verified_user, origin=loc_warsaw, destination=loc_wroclaw,
        time_start=now, time_end=now + timezone.timedelta(hours=4),
        vehicle_type=vt_reefer, length_km=Decimal("10.00")
    )
    resp = auth_client.get(f"{BASE}?vehicle_type_slug=reefer")
    ids = {x["id"] for x in resp.data["results"]} if isinstance(resp.data, dict) and "results" in resp.data else {x["id"] for x in resp.data}
    assert r2.id in ids and r1.id not in ids

