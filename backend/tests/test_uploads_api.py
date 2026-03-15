import pytest
from pathlib import Path
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

ROUTES = "/api/transport/routes"
PHOTOS = "/api/transport/route-photos"
CHAT = "/api/chat/messages"
VERIF = "/api/users/verification-docs"

# point to your real test files
HERE = Path(__file__).resolve().parent
PNG_PATH = HERE / "testowe.png"
PDF_PATH = HERE / "basic-text.pdf"


@pytest.mark.django_db
def test_route_photo_upload_list_delete(auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # create a route (owner = auth_client user)
    r = auth_client.post(
        ROUTES,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=3)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR",
        }, format="json"
    )
    assert r.status_code == 201, r.data
    rid = r.data["id"]

    # upload real PNG
    with PNG_PATH.open("rb") as fh:
        img = SimpleUploadedFile(PNG_PATH.name, fh.read(), content_type="image/png")
    up = auth_client.post(f"{ROUTES}/{rid}/photos", {"image": img, "caption": "front"}, format="multipart")
    assert up.status_code == 201, up.data
    pid = up.data["id"]
    assert isinstance(up.data.get("image"), str)

    # list
    lst = auth_client.get(f"{ROUTES}/{rid}/photos")
    assert lst.status_code == 200
    items = lst.data if isinstance(lst.data, list) else lst.data.get("results", [])
    assert any(p["id"] == pid for p in items)

    # delete (owner allowed)
    d = auth_client.delete(f"{PHOTOS}/{pid}")
    assert d.status_code in (200, 204)


@pytest.mark.django_db
def test_route_photo_upload_forbidden_for_non_owner(api_client, auth_client, verified_user, loc_warsaw, loc_wroclaw, vt_van, now):
    # owner creates route
    r = auth_client.post(
        ROUTES,
        {
            "origin": loc_warsaw.id, "destination": loc_wroclaw.id,
            "time_start": now.isoformat(), "time_end": (now + timezone.timedelta(hours=3)).isoformat(),
            "vehicle_type": vt_van.id, "price": "100.00", "currency": "EUR",
        }, format="json"
    )
    rid = r.data["id"]

    # another user tries to upload
    other = User.objects.create_user(username="o", email="o@x.com", password="x", is_email_verified=True)
    api_client.force_authenticate(user=other)
    with PNG_PATH.open("rb") as fh:
        img = SimpleUploadedFile(PNG_PATH.name, fh.read(), content_type="image/png")
    up = api_client.post(f"{ROUTES}/{rid}/photos", {"image": img}, format="multipart")
    assert up.status_code == 403


@pytest.mark.django_db
def test_chat_image_only_message(auth_client):
    # send a picture message (no text)
    with PNG_PATH.open("rb") as fh:
        img = SimpleUploadedFile(PNG_PATH.name, fh.read(), content_type="image/png")
    r = auth_client.post(CHAT, {"image": img}, format="multipart")
    assert r.status_code == 201, r.data
    assert r.data.get("image")


@pytest.mark.django_db
def test_verification_doc_upload_list_delete_pending(auth_client):
    # upload a real PDF
    with PDF_PATH.open("rb") as fh:
        pdf = SimpleUploadedFile(PDF_PATH.name, fh.read(), content_type="application/pdf")
    up = auth_client.post(VERIF, {"kind": "company", "file": pdf}, format="multipart")
    assert up.status_code == 201, up.data

    # list my docs
    lst = auth_client.get(VERIF)
    assert lst.status_code == 200
    items = lst.data if isinstance(lst.data, list) else lst.data.get("results", [])
    assert items and items[0]["status"] == "pending"
    vid = items[0]["id"]

    # delete allowed while pending
    d = auth_client.delete(f"{VERIF}/{vid}")
    assert d.status_code in (200, 204)

