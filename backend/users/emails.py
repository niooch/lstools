from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import email_verification_token, password_reset_token


def build_frontend_url(request, path, params):
    query = urlencode(params)
    configured = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    if configured:
        return f"{configured}{path}?{query}"
    return request.build_absolute_uri(f"{path}?{query}")

def send_verification_email(user, request):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    verify_path = reverse("email-verify")  # /api/v1/auth/verify-email
    verify_url = request.build_absolute_uri(f"{verify_path}?uid={uid}&token={token}")

    subject = "Verify your email"
    text = (
        f"Hi {user.first_name or user.username or 'there'},\n\n"
        f"Please verify your email by clicking this link:\n{verify_url}\n\n"
        "If you did not sign up, you can ignore this email."
    )
    html = f"""
        <p>Hi {user.first_name or user.username or 'there'},</p>
        <p>Please verify your email by clicking this link:</p>
        <p><a href="{verify_url}">{verify_url}</a></p>
        <p>If you did not sign up, you can ignore this email.</p>
    """

    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [user.email])
    msg.attach_alternative(html, "text/html")
    msg.send()


def send_password_reset_email(user, request):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = password_reset_token.make_token(user)
    reset_url = build_frontend_url(
        request,
        "/reset-password",
        {"uid": uid, "token": token},
    )

    subject = "Reset your password"
    text = (
        f"Hi {user.first_name or user.username or 'there'},\n\n"
        f"You can set a new password using this link:\n{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    html = f"""
        <p>Hi {user.first_name or user.username or 'there'},</p>
        <p>You can set a new password using this link:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>If you did not request a password reset, you can ignore this email.</p>
    """

    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [user.email])
    msg.attach_alternative(html, "text/html")
    msg.send()
