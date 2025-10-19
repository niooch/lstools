from rest_framework import serializers
from .models import Localisation
from rest_framework.validators import UniqueTogetherValidator

class LocalisationSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    lat = serializers.FloatField(source="latitude", read_only=True)
    lon = serializers.FloatField(source="longitude", read_only=True)

    class Meta:
        model = Localisation
        fields = (
            "id",
            "name",
            "lat",
            "lon",
            "latitude",
            "longitude",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "lat", "lon", "created_by", "created_at", "updated_at")
        validators = [
                UniqueTogetherValidator(
                    queryset=Localisation.objects.all(),
                    fields=("name", "latitude", "longitude"),
                    message="A localisation with this name and coordinates already exists.",
                    )
        ]
