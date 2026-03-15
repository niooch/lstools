import pytest
from django.utils import timezone

CHAT = "/api/chat/messages"
ROUTES = "/api/transport/routes"

@pytest.mark.django_db
def test_chat_filter_by_route(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    # create two routes
    a = auth_client.post(
        ROUTES,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR",
        },
        format="json",
    ).data["id"]

    b = auth_client.post(
        ROUTES,
        {
            "origin": loc_wroclaw.id, "destination": loc_warsaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id, "price": "200.00", "currency": "EUR",
        },
        format="json",
    ).data["id"]

    # post messages: one attached to each route and one without route
    m1 = auth_client.post(CHAT, {"content": "for A", "route": a}, format="json")
    m2 = auth_client.post(CHAT, {"content": "for B", "route": b}, format="json")
    m3 = auth_client.post(CHAT, {"content": "general"}, format="json")

    # filter by route=a
    resp = auth_client.get(f"{CHAT}?route={a}")
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    texts = [x["content"] for x in data]
    assert "for A" in texts
    assert "for B" not in texts

