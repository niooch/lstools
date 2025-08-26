from rest_framework import serializers
from .models import VehicleType

class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = ("id", "name", "slug", "description", "is_active", "created_at", "updated_at")
        read_only_fields = fields

