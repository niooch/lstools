import pytest
from django.utils import timezone

BASE = "/api/transport/routes"

@pytest.mark.django_db
def test_vehicle_category_attribute_filters(auth_client, loc_warsaw, loc_wroclaw, vt_van, vt_reefer, now):
    # make one van, one reefer
    r1 = auth_client.post(
        BASE, {"origin": loc_warsaw.id, "destination": loc_wroclaw.id,
               "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
               "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR"},
        format="json"
    ).data["id"]
    r2 = auth_client.post(
        BASE, {"origin": loc_warsaw.id, "destination": loc_wroclaw.id,
               "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=2)).isoformat(),
               "vehicle_type": vt_reefer.id, "price": "200.00", "currency": "EUR"},
        format="json"
    ).data["id"]

    resp_cat = auth_client.get(f"{BASE}?vehicle_category=reefer")
    ids_cat = {i["id"] for i in (resp_cat.data["results"] if isinstance(resp_cat.data, dict) and "results" in resp_cat.data else resp_cat.data)}
    assert r2 in ids_cat and r1 not in ids_cat

    resp_attr = auth_client.get(f"{BASE}?vehicle_attribute=V")
    ids_attr = {i["id"] for i in (resp_attr.data["results"] if isinstance(resp_attr.data, dict) and "results" in resp_attr.data else resp_attr.data)}
    assert r1 in ids_attr and r2 not in ids_attr

