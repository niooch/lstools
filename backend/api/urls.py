from django.urls import path, include

urlpatterns = [
        path("users/", include("users.urls")),

        path("auth/", include("users.auth_urls")),
        ]
