from decimal import Decimal, ROUND_HALF_UP
from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import VehicleType, Route, RouteStatus, RouteStop, CrewType, Currency
from . import services as svc

User = get_user_model()

class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = ("id",
                  "name",
                  "slug",
                  "description",
                  "is_active",
                  "category",
                  "attribute",
                  "created_at",
                  "updated_at")
        read_only_fields = (
                "id",
                "created_at",
                "updated_at",
                )

class StopOutSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="localisation.id")
    name = serializers.CharField(source="localisation.name")
    latitude = serializers.DecimalField(source="localisation.latitude", read_only=True, max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(source="localisation.longitude", read_only=True, max_digits=9, decimal_places=6)
    order = serializers.IntegerField(read_only=True)

    class Meta:
        model = RouteStop
        fields = ("id", "name", "latitude", "longitude", "order")


from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers
from django.contrib.auth import get_user_model
from localisations.models import Localisation
from .models import Route, RouteStop, CrewType
from . import services as svc  # module import so tests can monkeypatch
User = get_user_model()


class StopOutSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="localisation.id", read_only=True)
    name = serializers.CharField(source="localisation.name", read_only=True)
    latitude = serializers.DecimalField(source="localisation.latitude", read_only=True, max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(source="localisation.longitude", read_only=True, max_digits=9, decimal_places=6)
    order = serializers.IntegerField(read_only=True)

    class Meta:
        model = RouteStop
        fields = ("order", "id", "name", "latitude", "longitude")


class RouteSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)
    price_per_km = serializers.SerializerMethodField(read_only=True)

    crew = serializers.ChoiceField(choices=CrewType.choices, default=CrewType.SINGLE)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    currency = serializers.CharField(max_length=3, required=False)

    # Write: accept up to 5 stop ids; Read: return ordered stops
    stop_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False, allow_empty=True, write_only=True,
        help_text="Up to 5 intermediate stop Localisation IDs, in order."
    )
    stops = StopOutSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = (
            "id",
            "origin", "destination",
            "time_start", "time_end",
            "vehicle_type",
            "crew",
            "length_km",
            "price", "currency",
            "price_per_km",
            "stops", "stop_ids",
            "status", "sold_at", "cancelled_at",
            "owner", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "length_km", "price_per_km", "stops",
            "status", "sold_at", "cancelled_at",
            "owner", "created_at", "updated_at",
        )

    def get_price_per_km(self, obj):
        if obj.length_km and obj.length_km > 0 and obj.price:
            val = Decimal(obj.price) / Decimal(obj.length_km)
            return f"{val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)} {getattr(obj, 'currency', '')}".strip()
        return None

    # ---------------- helpers ----------------

    def _compute_length_sum(self, origin, stop_localisations, destination):
        """Sum: origin -> stops... -> destination (uses cached distance)."""
        pts = [origin] + list(stop_localisations) + [destination]
        total = Decimal("0.00")
        for a, b in zip(pts, pts[1:]):
            total += Decimal(
                svc.distance_km_cached(
                    float(a.latitude), float(a.longitude),
                    float(b.latitude), float(b.longitude)
                )
            )
        return total.quantize(Decimal("0.01"))

    def _validate_and_fetch_stops(self, stop_ids):
        """Validate <=5 stops first (so your 6-stops test returns 400), then load locs preserving order."""
        if stop_ids is None:
            return []
        if len(stop_ids) > 5:
            raise serializers.ValidationError({"stop_ids": "At most 5 stops allowed."})
        if len(set(stop_ids)) != len(stop_ids):
            raise serializers.ValidationError({"stop_ids": "Duplicate stops are not allowed."})
        if stop_ids and any(lid in (self.initial_data.get("origin"), self.initial_data.get("destination")) for lid in stop_ids):
            raise serializers.ValidationError({"stop_ids": "Stops cannot include origin or destination."})
        if not stop_ids:
            return []
        locs = list(Localisation.objects.filter(id__in=stop_ids))
        found = {l.id: l for l in locs}
        ordered = []
        for lid in stop_ids:
            if lid not in found:
                raise serializers.ValidationError({"stop_ids": f"Localisation id {lid} not found."})
            ordered.append(found[lid])
        return ordered

    def _set_stops_rows(self, route, stop_ids):
        """Persist RouteStop rows in order."""
        RouteStop.objects.filter(route=route).delete()
        if not stop_ids:
            return
        locs = list(Localisation.objects.filter(id__in=stop_ids))
        found = {l.id: l for l in locs}
        rows = []
        for idx, lid in enumerate(stop_ids, start=1):
            rows.append(RouteStop(route=route, order=idx, localisation=found[lid]))
        RouteStop.objects.bulk_create(rows)

    # ---------------- create / update ----------------

    def create(self, validated_data):
        stop_ids = validated_data.pop("stop_ids", [])
        # enforce limit BEFORE creating the route
        stops_locs = self._validate_and_fetch_stops(stop_ids)

        route = Route.objects.create(owner=self.context["request"].user, **validated_data)

        # compute and save length_km
        route.length_km = self._compute_length_sum(route.origin, stops_locs, route.destination)
        route.save(update_fields=["length_km"])

        # persist stops
        self._set_stops_rows(route, stop_ids)
        return route

    def update(self, instance, validated_data):
        # If caller provided stop_ids, validate & set; else keep existing
        provided = "stop_ids" in validated_data
        stop_ids = validated_data.pop("stop_ids", None)

        instance = super().update(instance, validated_data)

        if provided:
            stops_locs = self._validate_and_fetch_stops(stop_ids)
            self._set_stops_rows(instance, stop_ids)
        else:
            stops_locs = [
                s.localisation
                for s in instance.stops.select_related("localisation").order_by("order")
            ]

        # recompute length_km after any change to origin/destination or stops
        instance.length_km = self._compute_length_sum(instance.origin, stops_locs, instance.destination)
        instance.save(update_fields=["length_km", "updated_at"])
        return instance


    def filter_active(self, qs, name, value: bool):
        return qs.filter(status=RouteStatus.ACTIVE) if value else qs.exclude(status=RouteStatus.ACTIVE)
        # Recompute if endpoints changed
        if origin != instance.origin or destination != instance.destination or instance.length_km is None:
            validated_data["length_km"] = self._compute_length(origin, destination)
        return super().update(instance, validated_data)

