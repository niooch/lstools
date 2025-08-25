from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import LocalisationViewSet

router = SimpleRouter(trailing_slash=False)
router.register(r"", LocalisationViewSet, basename="localisation")

urlpatterns = [path("", include(router.urls))]

