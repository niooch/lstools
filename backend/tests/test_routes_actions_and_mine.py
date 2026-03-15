import pytest
from decimal import Decimal
from django.utils import timezone
from transports.models import RouteStatus

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_soft_delete_is_cancel(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    r = auth_client.post(
        BASE, {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=4)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"
        }, format="json"
    )
    rid = r.data["id"]
    d = auth_client.delete(f"{BASE}/{rid}")
    assert d.status_code in (200, 204)
    get = auth_client.get(f"{BASE}/{rid}")
    assert get.status_code == 200
    assert get.data["status"] == RouteStatus.CANCELLED

@pytest.mark.django_db
def test_cancel_and_sell_actions(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    cancel_route = auth_client.post(
        BASE, {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=4)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"
        }, format="json"
    )
    cancel_id = cancel_route.data["id"]
    c = auth_client.post(f"{BASE}/{cancel_id}/cancel")
    assert c.status_code == 200 and c.data["status"] == RouteStatus.CANCELLED

    s_cancelled = auth_client.post(f"{BASE}/{cancel_id}/sell", {"price": "150.00"}, format="json")
    assert s_cancelled.status_code == 400

    sell_route = auth_client.post(
        BASE, {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=4)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"
        }, format="json"
    )
    sell_id = sell_route.data["id"]
    s = auth_client.post(f"{BASE}/{sell_id}/sell", {"price": "150.00"}, format="json")
    assert s.status_code == 200 and s.data["status"] == RouteStatus.SOLD and s.data["price"] == "150.00"


@pytest.mark.django_db
def test_route_auto_cancels_after_start_time(auth_client, loc_warsaw, loc_wroclaw, vt_van, now):
    r = auth_client.post(
        BASE,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": (now - timezone.timedelta(hours=1)).isoformat(),
            "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
            "vehicle_type": vt_van.id,
            "price": "120.00",
            "currency": "EUR",
        },
        format="json",
    )
    rid = r.data["id"]

    detail = auth_client.get(f"{BASE}/{rid}")
    assert detail.status_code == 200, detail.data
    assert detail.data["status"] == RouteStatus.CANCELLED

@pytest.mark.django_db
def test_list_active_only_by_default(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # create three different statuses
    def create(price="100.00"):
        return auth_client.post(
            BASE, {
                "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
                "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
                "vehicle_type": vt_van.id, "price": price, "currency": "EUR"
            }, format="json"
        ).data["id"]

    a = create("100.00")        # active
    b = create("200.00")        # will sell
    c = create("300.00")        # will cancel
    auth_client.post(f"{BASE}/{b}/sell")
    auth_client.post(f"{BASE}/{c}/cancel")

    lst = auth_client.get(BASE)
    ids = {i["id"] for i in (lst.data["results"] if isinstance(lst.data, dict) and "results" in lst.data else lst.data)}
    assert a in ids and b not in ids and c not in ids

    sold = auth_client.get(f"{BASE}?status=sold")
    sold_ids = {i["id"] for i in (sold.data["results"] if isinstance(sold.data, dict) and "results" in sold.data else sold.data)}
    assert b in sold_ids

@pytest.mark.django_db
def test_mine_and_history(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # create two active and one sold
    ids = []
    for _ in range(2):
        r = auth_client.post(
            BASE, {"origin": loc_warsaw.id, "destination": loc_wroclaw.id,
                   "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
                   "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"},
            format="json"
        )
        ids.append(r.data["id"])
    sold = auth_client.post(
        BASE, {"origin": loc_warsaw.id, "destination": loc_wroclaw.id,
               "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
               "vehicle_type": vt_van.id, "price": "200.00", "currency": "EUR"},
        format="json"
    ).data["id"]
    auth_client.post(f"{BASE}/{sold}/sell")

    mine = auth_client.get(f"{BASE}/mine")
    mine_ids = {i["id"] for i in (mine.data["results"] if isinstance(mine.data, dict) and "results" in mine.data else mine.data)}
    assert sold not in mine_ids  # active only by default

    hist = auth_client.get(f"{BASE}/mine/history")
    hist_ids = {i["id"] for i in (hist.data["results"] if isinstance(hist.data, dict) and "results" in hist.data else hist.data)}
    assert sold in hist_ids
