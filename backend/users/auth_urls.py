from django.urls import path
from rest_framework_simplejwt.views import (
        TokenObtainPairView,
        TokenRefreshView,
        TokenVerifyView,
        )

urlpatterns = [
        path("token/create", TokenObtainPairView.as_view(), name="jwt-create"),
        path("token/refresh", TokenRefreshView.as_view(), name="jwt-refresh"),
        path("token/verify", TokenVerifyView.as_view(), name="jwt-verify"),
        ]
