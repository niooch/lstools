import math
import django_filters as df
from .models import Localisation

class LocalisationFilter(df.FilterSet):
    name = df.CharFilter(field_name="name", lookup_expr="icontains")
    min_lat = df.NumberFilter(field_name="latitude", lookup_expr="gte")
    max_lat = df.NumberFilter(field_name="latitude", lookup_expr="lte")
    min_lon = df.NumberFilter(field_name="longitude", lookup_expr="gte")
    max_lon = df.NumberFilter(field_name="longitude", lookup_expr="lte")

    near = df.CharFilter(method="filter_near")

    class Meta:
        model = Localisation
        fields = ['name', 'min_lat', 'max_lat', 'min_lon', 'max_lon', 'near']

    def filter_near(self, queryset, name, value):
        try:
            lat_str, lon_str, r_str = [v.strip() for v in value.split(",")]
            lat = float(lat_str); lon = float(lon_str); r_km = float(r_str)
        except Exception:
            return queryset  #ignore bad input

        dlat = r_km / 111.0
        dlon = r_km / (111.0 * max(0.000001, math.cos(math.radians(lat))))
        return queryset.filter(
            latitude__gte=lat - dlat,
            latitude__lte=lat + dlat,
            longitude__gte=lon - dlon,
            longitude__lte=lon + dlon,
        )
