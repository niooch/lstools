from rest_framework import serializers
from .models import Localisation

class LocalisationSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Localisation
        fields = (
            "id",
            "name",
            "latitude",
            "longitude",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
