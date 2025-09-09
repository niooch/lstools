from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Message

User = get_user_model()

class UserBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "nickname_color")

class MessageSerializer(serializers.ModelSerializer):
    user = UserBadgeSerializer(read_only=True)
    route_label = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "user", "content", "route", "route_label", "created_at", "deleted_at")
        read_only_fields = ("id", "user", "route_label", "created_at", "deleted_at")

    def get_route_label(self, obj):
        r = obj.route
        if not r:
            return None
        # short human label like “WRO5 → WAW (2025-09-01)”
        o = getattr(r.origin, "name", None) or "?"
        d = getattr(r.destination, "name", None) or "?"
        return f"{o} → {d}"

