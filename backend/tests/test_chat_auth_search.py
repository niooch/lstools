import pytest
from django.utils import timezone

CHAT = "/api/chat/messages"

@pytest.mark.django_db
def test_chat_list_requires_auth(api_client):
    r = api_client.get(CHAT)
    assert r.status_code in (401, 403)  # unauthenticated → 401 by default

@pytest.mark.django_db
def test_chat_search(auth_client):
    auth_client.post(CHAT, {"content": "general lane info"}, format="json")
    auth_client.post(CHAT, {"content": "reefer needed soon"}, format="json")

    r = auth_client.get(f"{CHAT}?search=reefer")
    data = r.data["results"] if isinstance(r.data, dict) and "results" in r.data else r.data
    texts = [m["content"] for m in data]
    assert any("reefer" in t for t in texts)
    assert not all("general lane info" in t for t in texts)  # ensure search filters

