from rest_framework import viewsets, permissions, filters as drf_filters
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
    permission_classes = [AllowAny]
    serializer_class = LocalisationSerializer
    queryset = Localisation.objects.all()
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["id", "name"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()

        # Bulk filters: ?ids=1,2  or  ?id__in=1,2
        raw = self.request.query_params.get("ids") or self.request.query_params.get("id__in")
        if raw:
            try:
                id_list = [int(x) for x in raw.split(",") if x.strip().isdigit()]
                if id_list:
                    qs = qs.filter(id__in=id_list)
            except ValueError:
                pass
        return qs

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
