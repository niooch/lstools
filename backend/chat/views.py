from rest_framework import viewsets, permissions
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from .models import Message
from .serializers import MessageSerializer
from .permissions import IsSenderOrStaff
from users.permissions import IsEmailVerified

from rest_framework.throttling import ScopedRateThrottle

class MessageViewSet(viewsets.ModelViewSet):
    """
    Simple site-wide feed for email-verified users.
    Optional filters:
      - ?route=<id>  (show only posts attached to that route)
      - ?after_id=<id> (show newer than id, for polling)
    """
    serializer_class = MessageSerializer
    queryset = Message.objects.select_related("user", "route", "route__origin", "route__destination")
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_fields = ["route"]
    search_fields = ["content", "user__username"]
    ordering_fields = ["id", "created_at"]  

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"

    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ["destroy"]:
            return [permissions.IsAuthenticated(), IsEmailVerified(), IsSenderOrStaff()]
        return [permissions.IsAuthenticated(), IsEmailVerified()]
    
    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().filter(deleted_at__isnull=True)

        after_id = request.query_params.get("after_id")
        if after_id:
            try:
                qs = qs.filter(id__gt=int(after_id))
            except (TypeError, ValueError):
                pass

        # apply the same filter/search/ordering stack as usual
        qs = self.filter_queryset(qs)

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)

        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    def perform_create(self, serializer):
        content = (self.request.data or {}).get("content", "")
        image = (self.request.data or {}).get("image")
        if (not content or not str(content).strip()) and not image:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"content": "Content or image is required."})
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete()
