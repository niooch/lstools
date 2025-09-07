from rest_framework import viewsets, permissions, filters as drf_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Localisation
from .serializers import LocalisationSerializer
from .filters import LocalisationFilter
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

@extend_schema_view(
    list=extend_schema(
        tags=["Localisations"],
        summary="List localisations",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Search by name"),
            OpenApiParameter("min_lat", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
            OpenApiParameter("max_lat", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
            OpenApiParameter("min_lon", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
            OpenApiParameter("max_lon", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
            OpenApiParameter("near", OpenApiTypes.STR, OpenApiParameter.QUERY, description='Bounding box near "lat,lon,r_km"'),
            OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY, description="created_at,name,latitude,longitude"),
        ],
    ),
    retrieve=extend_schema(tags=["Localisations"], summary="Get a localisation"),
)
class LocalisationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only list/retrieve. Creation is via the Django admin by superusers.
    """
    queryset = Localisation.objects.all().order_by("-created_at")
    serializer_class = LocalisationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_class = LocalisationFilter
    search_fields = ["name"]
    ordering_fields = ["created_at", "name", "latitude", "longitude"]

