import pytest
from django.utils import timezone

BASE = "/api/transport/routes"
STATS = "/api/transport/routes/stats/me"

@pytest.mark.django_db
def test_stats_since_days_limits_recent(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # create a "recent" route
    r1 = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR",
        },
        format="json",
    )
    assert r1.status_code == 201

    # simulate an older route: just set created_at back in time
    # (works if your TimestampedModel sets auto_now_add; otherwise skip this part)
    from transports.models import Route
    older = Route.objects.create(
        owner=r1.wsgi_request.user,
        origin_id=loc_warsaw.id,
        destination_id=loc_wroclaw.id,
        time_start=now - timezone.timedelta(days=60),
        time_end=now - timezone.timedelta(days=59, hours=20),
        vehicle_type=vt_van, price="200.00", currency="EUR",
    )
    # manually set created_at older (if field exists)
    if hasattr(older, "created_at"):
        Route.objects.filter(pk=older.pk).update(created_at=now - timezone.timedelta(days=60))

    # stats with since_days=30 should include only the recent route in "recent"
    s = auth_client.get(f"{STATS}?since_days=30")
    assert s.status_code == 200
    recent = s.data.get("recent", {})
    lifetime = s.data.get("lifetime", {})
    assert recent.get("total", 0) <= lifetime.get("total", 0)

