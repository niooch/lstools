from django_filters.rest_framework import DjangoFilterBackend
from .models import VehicleType, Route, RouteStatus, RoutePhoto
from .serializers import VehicleTypeSerializer, RouteSerializer, RoutePhotoSerializer
from .permissions import IsOwnerOrReadOnly
from users.permissions import IsFullyVerified
from .filters import RouteFilter
from . import services as svc
from localisations.models import Localisation
from drf_spectacular.utils import extend_schema_view, extend_schema, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework import viewsets, permissions, filters as drf_filters
from rest_framework import serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import status as drf_status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import mixins

from rest_framework.views import APIView
from django.db.models import Count, Sum, Avg, Q, F
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from django.shortcuts import get_object_or_404

from decimal import Decimal, ROUND_HALF_UP


class SuggestDistanceRequestSerializer(drf_serializers.Serializer):
    origin = drf_serializers.IntegerField(min_value=1)
    destination = drf_serializers.IntegerField(min_value=1)
    stop_ids = drf_serializers.ListField(
        child=drf_serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate_stop_ids(self, value):
        if len(value) > 5:
            raise drf_serializers.ValidationError("At most 5 stops allowed.")
        if len(set(value)) != len(value):
            raise drf_serializers.ValidationError("Duplicate stops are not allowed.")
        return value

    def validate(self, attrs):
        origin = attrs["origin"]
        destination = attrs["destination"]
        stop_ids = attrs.get("stop_ids", [])
        if origin == destination:
            raise drf_serializers.ValidationError({"destination": "Destination must be different from origin."})
        if any(lid in (origin, destination) for lid in stop_ids):
            raise drf_serializers.ValidationError({"stop_ids": "Stops cannot include origin or destination."})
        return attrs


def auto_cancel_started_routes():
    now = timezone.now()
    Route.objects.filter(
        status=RouteStatus.ACTIVE,
        time_start__lte=now,
    ).update(
        status=RouteStatus.CANCELLED,
        cancelled_at=now,
        updated_at=now,
    )




route_list_params = [
    OpenApiParameter("vehicle_type", OpenApiTypes.INT, OpenApiParameter.QUERY, description="VehicleType ID"),
    OpenApiParameter("vehicle_type_slug", OpenApiTypes.STR, OpenApiParameter.QUERY, description="VehicleType slug"),
    OpenApiParameter("available_on", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="Any time during this date"),
    OpenApiParameter("date_from", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="Overlap window start (date)"),
    OpenApiParameter("date_to", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="Overlap window end (date)"),
    OpenApiParameter("dt_from", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, description="Overlap window start (datetime)"),
    OpenApiParameter("dt_to", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, description="Overlap window end (datetime)"),
    OpenApiParameter("available_at", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, description="Must be active at this instant"),
    OpenApiParameter("origin_near", OpenApiTypes.STR, OpenApiParameter.QUERY, description='Bounding box near "lat,lon,r_km"'),
    OpenApiParameter("destination_near", OpenApiTypes.STR, OpenApiParameter.QUERY, description='Bounding box near "lat,lon,r_km"'),
    OpenApiParameter("origin_q", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Place name for origin (via Nominatim)"),
    OpenApiParameter("destination_q", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Place name for destination (via Nominatim)"),
    OpenApiParameter("radius_km", OpenApiTypes.NUMBER, OpenApiParameter.QUERY, description="Radius for *_q lookups (default 10)"),
    OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Full-text search (origin/destination/vehicle type)"),
    OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Sort by: time_start, time_end, length_km, price, created_at"),
]

route_examples = [
    OpenApiExample(
        "Overlap (datetime window)",
        value={"dt_from": "2025-09-01T08:00:00Z", "dt_to": "2025-09-03T18:00:00Z"},
        request_only=True,
    ),
    OpenApiExample(
        "Near Warsaw origin by name",
        value={"origin_q": "WRO5 amazon warehouse", "radius_km": 20},
        request_only=True,
    ),
    OpenApiExample(
        "Near coords & reefer only",
        value={"origin_near": "52.2297,21.0122,15", "vehicle_type_slug": "reefer"},
        request_only=True,
    ),
]

@extend_schema_view(
    list=extend_schema(
        tags=["Transport"],
        summary="List active vehicle types",
        examples=[
            OpenApiExample(
                "Search vans",
                value={"search": "van", "ordering": "name"},
                request_only=True,
            )
        ],
    ),
    retrieve=extend_schema(tags=["Transport"], summary="Get a vehicle type"),
)
class VehicleTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VehicleType.objects.filter(is_active=True).order_by("name")
    serializer_class = VehicleTypeSerializer
    permission_classes = [permissions.IsAuthenticated, IsFullyVerified]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["name", "created_at"]

@extend_schema(
  examples=[
    OpenApiExample(
      "Create with stops & double crew",
      value={
        "origin": 1,
        "destination": 4,
        "time_start": "2025-09-01T08:00:00Z",
        "time_end": "2025-09-01T18:00:00Z",
        "vehicle_type": 2,
        "crew": "double",
        "stop_ids": [10, 12],
        "price": "4200.00"
      },
      request_only=True
    )
  ]
)
@extend_schema_view(
    list=extend_schema(
        tags=["Transport"],
        summary="Search routes",
        parameters=route_list_params,
        examples=route_examples,
    ),
    retrieve=extend_schema(tags=["Transport"], summary="Get a single route"),
    create=extend_schema(
        tags=["Transport"],
        summary="Create a route",
        description="Requires an email-verified user with approved verification documents.",
        examples=[
            OpenApiExample(
                "Create route",
                value={
                    "origin": 1,
                    "destination": 2,
                    "time_start": "2025-09-01T08:00:00Z",
                    "time_end": "2025-09-01T18:00:00Z",
                    "vehicle_type": 1,
                    "price": "3500.00"
                },
                request_only=True,
            )
        ],
    ),
    partial_update=extend_schema(tags=["Transport"], summary="Update a route (partial)"),
    update=extend_schema(tags=["Transport"], summary="Update a route"),
    destroy=extend_schema(tags=["Transport"], summary="Delete a route"),
)
class RouteViewSet(viewsets.ModelViewSet):
    serializer_class = RouteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFullyVerified, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_class = RouteFilter
    search_fields = [
            "origin__name", "destination__name",
            "vehicle_type__name",
            ]
    ordering_fields = ["time_start", "time_end", "length_km", "price", "created_at"]

    throttle_classes = [ScopedRateThrottle]

    @action(
        detail=True, methods=["get", "post"], url_path="photos",
        parser_classes=[MultiPartParser, FormParser]
    )
    def photos(self, request, pk=None):
        route = self.get_object()
        if request.method.lower() == "get":
            qs = route.photos.all()
            return Response(RoutePhotoSerializer(qs, many=True, context=self.get_serializer_context()).data)

        # POST: owner or staff only
        if not (request.user.is_staff or route.owner_id == request.user.id):
            return Response({"detail": "Forbidden"}, status=403)
        image = request.data.get("image")
        if not image:
            return Response({"image": ["This field is required."]}, status=400)
        caption = request.data.get("caption", "")
        photo = RoutePhoto.objects.create(route=route, image=image, caption=caption, uploaded_by=request.user)
        return Response(RoutePhotoSerializer(photo, context=self.get_serializer_context()).data, status=201)


    
    def get_throttles(self):
        self.throttle_scope = "routes-write" if self.action in {
                "create", "update", "partial_update", "destroy", "sell", "cancel", "suggest_distance"
                } else None
        return super().get_throttles()

    def get_queryset(self):
        auto_cancel_started_routes()
        qs = (
                Route.objects.select_related("origin", "destination", "vehicle_type", "owner")
                .prefetch_related("stops__localisation")
                .order_by("-created_at")
                )
        if getattr(self, "action", None) == "list": 
            if "status" not in self.request.query_params and "active" not in self.request.query_params:
                qs = qs.filter(status=RouteStatus.ACTIVE)
        return qs

    def get_object(self):
        auto_cancel_started_routes()
        obj = get_object_or_404(
                Route.objects.select_related("origin", "destination", "vehicle_type", "owner"),
                pk=self.kwargs["pk"],
                )
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_destroy(self, instance):
        instance.mark_cancelled()

    @extend_schema(
            tags=["Transport"],
            summary="My routes (ACTIVE by default)",
            description=(
                "Returns routes owned by the authenticated user. "
                "Defaults to ACTIVE only; pass ?status=sold or ?status=cancelled to filter, "
                "or any of the standard query params (dt_from, dt_to, origin_q, vehicle_type_slug, search, ordering, ...)."
                ),
            parameters=[
                OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY,
                                 description="active | sold | cancelled (default active)"),
                OpenApiParameter("dt_from", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("dt_to", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("available_at", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("origin_q", OpenApiTypes.STR, OpenApiParameter.QUERY),
                OpenApiParameter("radius_km", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
                OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY),
                OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY),
                ],
            )
    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        auto_cancel_started_routes()
        qs = Route.objects.select_related("origin", "destination", "vehicle_type", "owner").filter(owner=request.user)
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @extend_schema(
            tags=["Transport"],
            summary="My route history (SOLD/CANCELLED)",
            description="Returns SOLD and CANCELLED routes owned by the authenticated user. Supports the same filters/search/ordering.",
            parameters=[
                OpenApiParameter("dt_from", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("dt_to", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("available_at", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
                OpenApiParameter("origin_q", OpenApiTypes.STR, OpenApiParameter.QUERY),
                OpenApiParameter("radius_km", OpenApiTypes.NUMBER, OpenApiParameter.QUERY),
                OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY),
                OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY),
                ],
            )
    @action(detail=False, methods=["get"], url_path="mine/history")
    def mine_history(self, request):
        auto_cancel_started_routes()
        qs = (
                Route.objects.select_related("origin", "destination", "vehicle_type", "owner")
                .filter(owner=request.user, status__in=[RouteStatus.SOLD, RouteStatus.CANCELLED])
                )
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @extend_schema(
            tags=["Transport"],
            summary="Suggest distance for route points",
            description="Returns server-calculated length_km using OSRM with Euclidean fallback.",
            request=SuggestDistanceRequestSerializer,
            responses={200: OpenApiTypes.OBJECT},
            )
    @action(detail=False, methods=["post"], url_path="suggest-distance")
    def suggest_distance(self, request):
        serializer = SuggestDistanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        origin_id = serializer.validated_data["origin"]
        destination_id = serializer.validated_data["destination"]
        stop_ids = serializer.validated_data.get("stop_ids", [])

        needed_ids = [origin_id, destination_id, *stop_ids]
        loc_map = Localisation.objects.in_bulk(needed_ids)
        missing = [lid for lid in needed_ids if lid not in loc_map]
        if missing:
            return Response(
                {"detail": f"Localisation id {missing[0]} not found."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        ordered_points = [loc_map[origin_id], *[loc_map[sid] for sid in stop_ids], loc_map[destination_id]]
        total = Decimal("0.00")
        for a, b in zip(ordered_points, ordered_points[1:]):
            total += Decimal(
                svc.distance_km_cached(
                    float(a.latitude), float(a.longitude),
                    float(b.latitude), float(b.longitude),
                )
            )

        total = total.quantize(Decimal("0.01"))
        return Response({"length_km": str(total)})


    @extend_schema(
            tags=["Transport"],
            summary="Mark route as cancelled",
            description="Mark route as cancelled",
            )
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        route = self.get_object()
        self.check_object_permissions(request, route)
        route.mark_cancelled()
        return Response(RouteSerializer(route, context=self.get_serializer_context()).data)
    @extend_schema(
            tags=["Transport"],
            summary="Mark route as sold",
            description="Mark route as sold",
            )
    @action(detail=True, methods=["post"])
    def sell(self, request, pk=None):
        route = self.get_object()
        self.check_object_permissions(request, route)
        if route.status != RouteStatus.ACTIVE:
            return Response({"detail": "Only active routes can be sold."}, status=400)
        price_override = request.data.get("price")

        if price_override is not None:
            route.price = price_override          # <- write to the 'price' field
            route.save(update_fields=["price", "updated_at"])

        route.mark_sold()
        return Response(RouteSerializer(route, context=self.get_serializer_context()).data)

class RoutePhotoViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = RoutePhoto.objects.select_related("route", "uploaded_by")
    serializer_class = RoutePhotoSerializer
    permission_classes = [permissions.IsAuthenticated, IsFullyVerified]

    def perform_destroy(self, instance):
        user = self.request.user
        if not (user.is_staff or instance.route.owner_id == user.id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Forbidden")
        # try removing the file from storage after row deletion
        storage, name = instance.image.storage, instance.image.name
        super().perform_destroy(instance)
        if name:
            try:
                storage.delete(name)
            except Exception:
                pass

@extend_schema(
        tags=["Transport"],
        summary="Route statistics",
        description="Counts and agregates for auth users routes. Use ?since_days=30 default.",
        )
class MyRouteStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFullyVerified]

    def get(self, request):
        auto_cancel_started_routes()
        try:
            since_days = int(request.query_params.get("since_days", 30))
        except (TypeError, ValueError):
            since_days = 30
        if since_days < 0:
            since_days = 30
        since = timezone.now() - timezone.timedelta(days=since_days)

        qs_all = Route.objects.filter(owner=request.user)
        qs_recent = qs_all.filter(created_at__gte=since)

        def aggregates(qs):
            base = qs.aggregate(
                    total=Count("id"),
                    active=Count("id", filter=Q(status=RouteStatus.ACTIVE)),
                    sold=Count("id", filter=Q(status=RouteStatus.SOLD)),
                    cancelled=Count("id", filter=Q(status=RouteStatus.CANCELLED)),
                    sum_km=Sum("length_km"),
                    sum_price=Sum("price"),
                    avg_price=Avg("price"),
                    )
            priced = qs.filter(length_km__gt=0, price__isnull=False).values_list("price", "length_km")
            if priced:
                s = sum(Decimal(p)/Decimal(km) for p, km in priced)
                base["avg_price_per_km"] = str((s / len(priced)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            else:
                base["avg_price_per_km"] = None
            return base

        top_vtypes = list(
                qs_all.values(name=F("vehicle_type__name"))
                .annotate(count=Count("id"))
                .order_by("-count")[:5]
                )

        data = {
                "since_days": since_days,
                "lifetime": aggregates(qs_all),
                "recent": aggregates(qs_recent),
                "top_vehicle_types": top_vtypes,
                }
        return Response(data)
