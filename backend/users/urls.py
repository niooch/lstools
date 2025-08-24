from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import UserViewSet, me, MeUpdateView, RegisterView

router = SimpleRouter(trailing_slash=False)
router.register(r"", UserViewSet, basename="user")
urlpatterns = [
        path("me", me, name="me"),
        path("me/update", MeUpdateView.as_view(), name="me-update"),
        path("register", RegisterView.as_view(), name="register"),
        path("", include(router.urls)),
]
