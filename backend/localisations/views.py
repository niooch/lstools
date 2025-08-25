from rest_framework import viewsets, permissions, filters as drf_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Localisation
from .serializers import LocalisationSerializer
from .filters import LocalisationFilter

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

