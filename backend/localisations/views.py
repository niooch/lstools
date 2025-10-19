from rest_framework import mixins, viewsets, permissions, filters as drf_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Localisation
from .serializers import LocalisationSerializer
from .filters import LocalisationFilter
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from localisations import services as geo_svc 
from rest_framework.permissions import IsAuthenticatedOrReadOnly

class LocalisationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LocalisationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only the requesting user's localisations
        return Localisation.objects.filter(created_by=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

@api_view(["GET"])
@permission_classes([AllowAny])
def nominatim_proxy(request):
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response({"detail": "q required"}, status=400)
    hits = geo_svc.nominatim_search(q, limit=1)
    if not hits:
        return Response({"point": None, "label": q})
    lat = float(hits[0]["lat"])
    lon = float(hits[0]["lon"])
    return Response({"point": {"lat": lat, "lon": lon}, "label": hits[0].get("display_name", q)})
