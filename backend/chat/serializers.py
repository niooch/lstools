from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Message
from users.serializers import PublicUserSerializer

User = get_user_model()

class MessageSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    content = serializers.CharField(allow_blank=True, required=False)
    route_label = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Message
        fields = ("id", "user", "content", "image", "route", "route_label", "created_at", "deleted_at")
        read_only_fields = ("id", "user", "route_label", "created_at", "deleted_at")

    def get_route_label(self, obj):
        r = obj.route
        if not r:
            return None
        # short human label like “WRO5 → WAW (2025-09-01)”
        o = getattr(r.origin, "name", None) or "?"
        d = getattr(r.destination, "name", None) or "?"
        return f"{o} → {d}"

    def validate(self, attrs):
        content = (attrs.get("content") or "").strip()
        image = attrs.get("image")
        if not content and not image:
            raise serializers.ValidationError({"content": "Provide content or image.", "image": "Provide content or image."})
        return attrs



