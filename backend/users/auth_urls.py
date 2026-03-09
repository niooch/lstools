from django.urls import path
from rest_framework_simplejwt.views import (
        TokenObtainPairView,
        TokenRefreshView,
        TokenVerifyView,
        )
from .views import VerifyEmailView, ResendVerificationView, PasswordResetRequestView, PasswordResetConfirmView


urlpatterns = [
        path("token/create", TokenObtainPairView.as_view(), name="jwt-create"),
        path("token/refresh", TokenRefreshView.as_view(), name="jwt-refresh"),
        path("token/verify", TokenVerifyView.as_view(), name="jwt-verify"),
        path("verify-email", VerifyEmailView.as_view(), name="email-verify"),
        path("resend-verification", ResendVerificationView.as_view(), name="resend-verification"),
        path("password-reset", PasswordResetRequestView.as_view(), name="password-reset"),
        path("password-reset/confirm", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
        ]
