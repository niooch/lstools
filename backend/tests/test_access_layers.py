import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from users.models import VerificationDocument, VerificationStatus


CHAT = "/api/chat/messages"
ROUTES = "/api/transport/routes"
VEHICLE_TYPES = "/api/transport/vehicle-types"
VERIFICATION_DOCS = "/api/users/verification-docs"
LOCALISATIONS = "/api/localisations"
ME = "/api/users/me"


@pytest.mark.django_db
def test_unverified_user_cannot_post_chat_or_verification_docs(api_client, unverified_user):
    api_client.force_authenticate(user=unverified_user)

    chat = api_client.post(CHAT, {"content": "blocked"}, format="json")
    docs = api_client.post(
        VERIFICATION_DOCS,
        {
            "kind": "company",
            "file": SimpleUploadedFile("id.pdf", b"%PDF-1.4 blocked", content_type="application/pdf"),
        },
        format="multipart",
    )

    assert chat.status_code == 403
    assert docs.status_code == 403


@pytest.mark.django_db
def test_email_verified_without_docs_cannot_access_transport_tools(
    api_client,
    email_verified_user,
    loc_warsaw,
    loc_wroclaw,
    vt_van,
    now,
):
    api_client.force_authenticate(user=email_verified_user)

    list_routes = api_client.get(ROUTES)
    create_route = api_client.post(
        ROUTES,
        {
            "origin": loc_warsaw.id,
            "destination": loc_wroclaw.id,
            "time_start": now.isoformat(),
            "time_end": now.isoformat(),
            "vehicle_type": vt_van.id,
            "price": "100.00",
            "currency": "PLN",
        },
        format="json",
    )
    vehicle_types = api_client.get(VEHICLE_TYPES)
    localisations = api_client.get(LOCALISATIONS)

    assert list_routes.status_code == 403
    assert create_route.status_code == 403
    assert vehicle_types.status_code == 403
    assert localisations.status_code == 403


@pytest.mark.django_db
def test_me_exposes_verification_capabilities(auth_client, email_verified_user, api_client):
    approved_doc = VerificationDocument.objects.create(
        user=email_verified_user,
        kind="company",
        file="verification/capability.pdf",
        status=VerificationStatus.APPROVED,
    )

    me_full = auth_client.get(ME)
    assert me_full.status_code == 200, me_full.data
    assert me_full.data["is_email_verified"] is True
    assert me_full.data["has_approved_verification"] is True
    assert me_full.data["is_fully_verified"] is True

    api_client.force_authenticate(user=email_verified_user)
    me_email_only = api_client.get(ME)
    assert me_email_only.status_code == 200, me_email_only.data
    assert me_email_only.data["is_email_verified"] is True
    assert me_email_only.data["has_approved_verification"] is True
    assert me_email_only.data["is_fully_verified"] is True

    approved_doc.delete()
    me_email_only = api_client.get(ME)
    assert me_email_only.status_code == 200, me_email_only.data
    assert me_email_only.data["is_email_verified"] is True
    assert me_email_only.data["has_approved_verification"] is False
    assert me_email_only.data["is_fully_verified"] is False


@pytest.mark.django_db
def test_fully_verified_user_can_retrieve_other_users_localisation(api_client, loc_warsaw):
    other = loc_warsaw.created_by.__class__.objects.create_user(
        username="loc_reader",
        email="loc_reader@example.com",
        password="x",
        is_email_verified=True,
    )
    VerificationDocument.objects.create(
        user=other,
        kind="company",
        file="verification/loc-reader-approved.pdf",
        status=VerificationStatus.APPROVED,
    )
    api_client.force_authenticate(user=other)

    resp = api_client.get(f"{LOCALISATIONS}/{loc_warsaw.id}")

    assert resp.status_code == 200, resp.data
    assert resp.data["id"] == loc_warsaw.id
