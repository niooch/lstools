from rest_framework import mixins, viewsets, permissions
from .models import Localisation
from .serializers import LocalisationSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from localisations import services as geo_svc 
from users.permissions import IsFullyVerified

class LocalisationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LocalisationSerializer
    permission_classes = [permissions.IsAuthenticated, IsFullyVerified]

    def get_queryset(self):
        qs = Localisation.objects.all().order_by("-created_at")
        if getattr(self, "action", None) == "list":
            # Keep the list scoped to the requester's own saved points.
            return qs.filter(created_by=self.request.user)
        return qs

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
