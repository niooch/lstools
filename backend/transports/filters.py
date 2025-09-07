# transports/filters.py
import math
import re
import django_filters as df
from datetime import datetime, time
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.timezone import make_aware, is_naive, get_default_timezone

from .models import Route, VehicleType
from localisations import services as geo_svc  # patchable in tests

# ---------- helpers ----------------------------------------------------------

def _aware(dt):
    """Make a datetime timezone-aware in the project's default TZ if it's naive."""
    if dt is None:
        return None
    return make_aware(dt, get_default_timezone()) if is_naive(dt) else dt

def _day_bounds(d):
    """Return start/end datetimes for a given date in the default TZ."""
    tz = get_default_timezone()
    start = make_aware(datetime.combine(d, time.min), tz)
    end = make_aware(datetime.combine(d, time.max), tz)
    return start, end

def _parse_dt_forgiving(value: str):
    """
    Parse ISO datetimes and handle a common URL-decoding quirk where '+HH:MM'
    becomes a space ' HH:MM'. Supports optional fractional seconds.
    Examples handled:
      '2025-08-27T12:00:00+00:00'  → ok
      '2025-08-27T12:00:00 00:00'  → fixed to '+00:00'
    """
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        m = re.match(r'^(.*T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)\s(\d{2}:\d{2})$', value)
        if m:
            fixed = f"{m.group(1)}+{m.group(2)}"
            dt = parse_datetime(fixed)
        if dt is None and " " in value and "T" in value and "+" not in value:
            head, tail = value.rsplit(" ", 1)
            if re.match(r"^\d{2}:\d{2}(?::\d{2})?$", tail):
                dt = parse_datetime(f"{head}+{tail}")
    return _aware(dt)

# ---------- FilterSet --------------------------------------------------------

class RouteFilter(df.FilterSet):
    # Vehicle type filters
    vehicle_type = df.ModelChoiceFilter(queryset=VehicleType.objects.filter(is_active=True))
    vehicle_type_slug = df.CharFilter(field_name="vehicle_type__slug", lookup_expr="iexact")

    # Date-based (backwards compatibility)
    available_on = df.DateFilter(method="filter_available_on")
    date_from = df.DateFilter(method="filter_date_from")
    date_to = df.DateFilter(method="filter_date_to")

    # Datetime-based (use CharFilter; we parse forgivingly)
    dt_from = df.CharFilter(method="filter_dt_from")
    dt_to = df.CharFilter(method="filter_dt_to")
    available_at = df.CharFilter(method="filter_available_at")

    # Proximity
    origin_near = df.CharFilter(method="filter_origin_near")           # "lat,lon,r_km"
    destination_near = df.CharFilter(method="filter_destination_near") # "lat,lon,r_km"
    origin_q = df.CharFilter(method="filter_origin_q")                 # place name via Nominatim
    destination_q = df.CharFilter(method="filter_destination_q")       # place name via Nominatim
    radius_km = df.NumberFilter(method="noop")                         # companion for *_q (defaults to 10)

    class Meta:
        model = Route
        fields = [
            "vehicle_type", "vehicle_type_slug",
            "available_on", "date_from", "date_to",
            "dt_from", "dt_to", "available_at",
            "origin_near", "destination_near",
            "origin_q", "destination_q", "radius_km",
        ]

    def noop(self, qs, name, value):
        return qs

    # ----- date-based --------------------------------------------------------

    def filter_available_on(self, qs, name, value):
        start, end = _day_bounds(value)
        return qs.filter(time_start__lte=end, time_end__gte=start)

    def filter_date_from(self, qs, name, value):
        other = self.data.get("date_to")
        if other:
            d_to = parse_date(other)
            if d_to:
                start, _ = _day_bounds(value)
                _, end = _day_bounds(d_to)
                return qs.filter(time_start__lte=end, time_end__gte=start)
        start, _ = _day_bounds(value)
        return qs.filter(time_end__gte=start)

    def filter_date_to(self, qs, name, value):
        other = self.data.get("date_from")
        if other:
            d_from = parse_date(other)
            if d_from:
                _, end = _day_bounds(value)
                start, _ = _day_bounds(d_from)
                return qs.filter(time_start__lte=end, time_end__gte=start)
        _, end = _day_bounds(value)
        return qs.filter(time_start__lte=end)

    # ----- datetime-based ----------------------------------------------------

    def filter_available_at(self, qs, name, value):
        dt = _parse_dt_forgiving(value)
        if not dt:
            return qs.none()
        return qs.filter(time_start__lte=dt, time_end__gte=dt)

    def filter_dt_from(self, qs, name, value):
        dt_from = _parse_dt_forgiving(value)
        if not dt_from:
            return qs
        other = self.data.get("dt_to")
        if other:
            dt_to = _parse_dt_forgiving(other)
            if dt_to:
                return qs.filter(time_start__lte=dt_to, time_end__gte=dt_from)
        return qs.filter(time_end__gte=dt_from)

    def filter_dt_to(self, qs, name, value):
        dt_to = _parse_dt_forgiving(value)
        if not dt_to:
            return qs
        other = self.data.get("dt_from")
        if other:
            dt_from = _parse_dt_forgiving(other)
            if dt_from:
                return qs.filter(time_start__lte=dt_to, time_end__gte=dt_from)
        return qs.filter(time_start__lte=dt_to)

    # ----- proximity ---------------------------------------------------------

    def _apply_near(self, qs, field_prefix: str, lat: float, lon: float, r_km: float):
        dlat = r_km / 111.0
        dlon = r_km / (111.0 * max(0.000001, math.cos(math.radians(lat))))
        return qs.filter(
            **{
                f"{field_prefix}__latitude__gte": lat - dlat,
                f"{field_prefix}__latitude__lte": lat + dlat,
                f"{field_prefix}__longitude__gte": lon - dlon,
                f"{field_prefix}__longitude__lte": lon + dlon,
            }
        )

    def _parse_latlonr(self, value: str):
        try:
            lat_str, lon_str, r_str = [v.strip() for v in value.split(",")]
            return float(lat_str), float(lon_str), float(r_str)
        except Exception:
            return None

    def filter_origin_near(self, qs, name, value):
        parsed = self._parse_latlonr(value)
        if not parsed:
            return qs
        lat, lon, r = parsed
        return self._apply_near(qs, "origin", lat, lon, r)

    def filter_destination_near(self, qs, name, value):
        parsed = self._parse_latlonr(value)
        if not parsed:
            return qs
        lat, lon, r = parsed
        return self._apply_near(qs, "destination", lat, lon, r)

    def _query_via_nominatim(self, place: str):
        res = geo_svc.nominatim_search(place, limit=1)
        if not res:
            return None
        return float(res[0]["lat"]), float(res[0]["lon"])

    def filter_origin_q(self, qs, name, value):
        coords = self._query_via_nominatim(value)
        if not coords:
            return qs.none()
        r = float(self.data.get("radius_km", 10))
        return self._apply_near(qs, "origin", coords[0], coords[1], r)

    def filter_destination_q(self, qs, name, value):
        coords = self._query_via_nominatim(value)
        if not coords:
            return qs.none()
        r = float(self.data.get("radius_km", 10))
        return self._apply_near(qs, "destination", coords[0], coords[1], r)
