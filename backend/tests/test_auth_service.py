import pytest
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from users.tokens import password_reset_token


PASSWORD_RESET = "/api/auth/password-reset"
PASSWORD_RESET_CONFIRM = "/api/auth/password-reset/confirm"


@pytest.mark.django_db
def test_password_reset_request_is_generic(api_client, unverified_user):
    known = api_client.post(
        PASSWORD_RESET,
        {"email": unverified_user.email},
        format="json",
    )
    missing = api_client.post(
        PASSWORD_RESET,
        {"email": "missing@example.com"},
        format="json",
    )

    assert known.status_code == 200, known.data
    assert missing.status_code == 200, missing.data
    assert known.data["detail"] == missing.data["detail"]


@pytest.mark.django_db
def test_password_reset_confirm_updates_password(api_client, unverified_user):
    uid = urlsafe_base64_encode(force_bytes(unverified_user.pk))
    token = password_reset_token.make_token(unverified_user)
    new_password = "StrongPassw0rd!"

    resp = api_client.post(
        PASSWORD_RESET_CONFIRM,
        {
            "uid": uid,
            "token": token,
            "new_password": new_password,
            "confirm_password": new_password,
        },
        format="json",
    )

    assert resp.status_code == 200, resp.data
    unverified_user.refresh_from_db()
    assert unverified_user.check_password(new_password)


@pytest.mark.django_db
def test_password_reset_confirm_rejects_invalid_token(api_client, unverified_user):
    uid = urlsafe_base64_encode(force_bytes(unverified_user.pk))

    resp = api_client.post(
        PASSWORD_RESET_CONFIRM,
        {
            "uid": uid,
            "token": "bad-token",
            "new_password": "StrongPassw0rd!",
            "confirm_password": "StrongPassw0rd!",
        },
        format="json",
    )

    assert resp.status_code == 400
