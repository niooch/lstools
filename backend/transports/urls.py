from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import VehicleTypeViewSet

router = SimpleRouter(trailing_slash=False)
router.register(r"vehicle-types", VehicleTypeViewSet, basename="vehicle-type")

urlpatterns = [path("", include(router.urls))]

