import pytest

BASE = "/api/chat/messages"

@pytest.mark.django_db
def test_post_requires_verified(api_client, verified_user, unverified_user):
    # unverified cannot post
    api_client.force_authenticate(user=unverified_user)
    r = api_client.post(BASE, {"content": "hello"}, format="json")
    assert r.status_code == 403

    # verified can post
    api_client.force_authenticate(user=verified_user)
    r2 = api_client.post(BASE, {"content": "first!"}, format="json")
    assert r2.status_code == 201
    assert r2.data["user"]["username"] == "u_verified"
    assert r2.data["user"]["nickname_color"].startswith("#")

@pytest.mark.django_db
def test_list_and_after_id(auth_client):
    a = auth_client.post(BASE, {"content": "one"}, format="json").data["id"]
    b = auth_client.post(BASE, {"content": "two"}, format="json").data["id"]

    lst = auth_client.get(BASE)
    assert lst.status_code == 200
    ids = {m["id"] for m in (lst.data["results"] if isinstance(lst.data, dict) and "results" in lst.data else lst.data)}
    assert a in ids and b in ids

    newer = auth_client.get(f"{BASE}?after_id={a}")
    newer_ids = {m["id"] for m in (newer.data["results"] if isinstance(newer.data, dict) and "results" in newer.data else newer.data)}
    assert b in newer_ids and a not in newer_ids

@pytest.mark.django_db
def test_delete_only_sender_or_staff(api_client, verified_user, staff_user):
    # verified posts
    api_client.force_authenticate(user=verified_user)
    r = api_client.post(BASE, {"content": "mine"}, format="json")
    mid = r.data["id"]

    # another non-staff cannot delete (not authenticated here → 401)
    api_client.force_authenticate(user=None)
    d1 = api_client.delete(f"{BASE}/{mid}")
    assert d1.status_code in (401, 403)

    # staff can delete
    api_client.force_authenticate(user=staff_user)
    d2 = api_client.delete(f"{BASE}/{mid}")
    assert d2.status_code in (200, 204)

    # should be hidden from list now
    api_client.force_authenticate(user=verified_user)
    lst = api_client.get(BASE)
    ids = {m["id"] for m in (lst.data["results"] if isinstance(lst.data, dict) and "results" in lst.data else lst.data)}
    assert mid not in ids

