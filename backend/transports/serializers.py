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


class RouteSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)
    price_per_km = serializers.SerializerMethodField()

    crew = serializers.ChoiceField(choices=CrewType.choices, default=CrewType.SINGLE)
    stops_ids = serializers.ListField(
            child=serializers.IntegerField(min_value=1),
            write_only=True,
            required=False,
            allow_empty=True,
            max_length=5,
            help_text="List of up to 5 localisation IDs for intermediate stops, in order."
            )
    currency = serializers.ChoiceField(choices=Currency.choices, default=Currency.EUR)
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    stops = StopOutSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = (
                "id",
                "origin",
                "destination",
                "time_start",
                "time_end",
                "crew",
                "vehicle_type",
                "length_km",
                "price",
                "currency",
                "price_per_km",
                "stops",
                "stops_ids",
                "status",
                "sold_at",
                "cancelled_at",
                "owner",
                "created_at",
                "updated_at",
                )
        read_only_fields = ("id", "length_km", "price_per_km", "stops", "status", "sold_at", "cancelled_at", "owner", "created_at", "updated_at")

    def get_price_per_km(self, obj):
        if obj.length_km and obj.length_km > 0 and obj.price:
            val = Decimal(obj.price) / Decimal(obj.length_km)
            return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return None

    def _compute_length_sum(self, origin, stop_localisations, destination):
        """
        Sum the distances: origin -> stops... -> destination
        using the cached OSRM/haversine helper.
        """
        points = [origin] + list(stop_localisations) + [destination]
        total = Decimal("0.00")
        for a, b in zip(points, points[1:]):
            lat1, lon1 = float(a.latitude), float(a.longitude)
            lat2, lon2 = float(b.latitude), float(b.longitude)
            total += svc.distance_km_cached(lat1, lon1, lat2, lon2)
        return total.quantize(Decimal("0.01"))

    def _set_stops(self, route, stop_ids):
        RouteStop.objects.filter(route=route).delete()
        if not stop_ids:
            return []
        locs = list(Localisation.objects.filter(id__in=stop_ids))
        found = {l.id: l for l in locs}
        stops = []
        for idx, loc_id in enumerate(stop_ids, start=1):
            loc = found.get(loc_id)
            if not loc:
                raise serializers.ValidationError({"stop_ids": f"Localisation id {loc_id} not found."})
            stops.append(RouteStop(route=route, order=idx, localisation=loc))
        RouteStop.objects.bulk_create(stops)
        return stops

    def create(self, validated_data):
        request = self.context["request"]
        stop_ids = validated_data.pop("stops_ids", [])
        if len(stop_ids) > 5:
            raise serializers.ValidationError({"stops_ids": "A maximum of 5 stops is allowed."})

        route = Route.objects.create(owner=request.user, **validated_data)

        stops = []
        if stop_ids:
            locs = list(Localisation.objects.filter(id__in=stop_ids))
            found = {l.id: l for l in locs}
            for loc_id in stop_ids:
                if loc_id not in found:
                    raise serializers.ValidationError({"stops_ids": f"Localisation id {loc_id} not found."})
                stops.append(loc)

        route.lengt_km = self._compute_length_sum(route.origin, stops, route.destination)
        route.save(update_fields=["length_km"])

        self._set_stops(route, stop_ids)
        return route

    def update(self, instance, validated_data):
        stop_ids = validated_data.pop("stop_ids", None)  # None => unchanged
        instance = super().update(instance, validated_data)

        # figure stops for length recompute
        if stop_ids is not None:
            if len(stop_ids) > 5:
                raise serializers.ValidationError({"stop_ids": "At most 5 stops allowed."})
            # update db stops
            self._set_stops(instance, stop_ids)
            # build ordered loc list for length
            locs = list(Localisation.objects.filter(id__in=stop_ids))
            order_map = {lid: i for i, lid in enumerate(stop_ids)}
            locs.sort(key=lambda l: order_map[l.id])
            stops_locs = locs
        else:
            # reuse current stops order
            stops_locs = [s.localisation for s in instance.stops.select_related("localisation").order_by("order")]

        instance.length_km = self._compute_length_sum(instance.origin, stops_locs, instance.destination)
        instance.save(update_fields=["length_km", "updated_at"])
        return instance
    def filter_active(self, qs, name, value: bool):
        return qs.filter(status=RouteStatus.ACTIVE) if value else qs.exclude(status=RouteStatus.ACTIVE)
        # Recompute if endpoints changed
        if origin != instance.origin or destination != instance.destination or instance.length_km is None:
            validated_data["length_km"] = self._compute_length(origin, destination)
        return super().update(instance, validated_data)

