from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import VehicleTypeViewSet, RouteViewSet, MyRouteStatsView


router = SimpleRouter(trailing_slash=False)
router.register("vehicle-types", VehicleTypeViewSet, basename="vehicle-type")
router.register("routes", RouteViewSet, basename="route")

urlpatterns = [
        path("", include(router.urls)),
        path("routes/stats/me", MyRouteStatsView.as_view(), name="route-stats-me"),
        ]

