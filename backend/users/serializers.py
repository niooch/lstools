from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from transports.models import Route, RouteStatus

User = get_user_model()

class PublicUserSerializer(serializers.ModelSerializer):
    route_stats = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", 
                  "username", 
                  "display_name",
                  "nickname_color",
                  "bio",
                  "route_stats")
        read_only_fields = ("id", "username")

    def get_route_stats(self, obj):
        qs = Route.objects.filter(owner=obj)
        return {
                "active": qs.filter(status=RouteStatus.ACTIVE).count(),
                "sold": qs.filter(status=RouteStatus.SOLD).count(),
                "cancelled": qs.filter(status=RouteStatus.CANCELLED).count(),
                "total": qs.count(),
                }
class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "username", "email",
            "display_name", "bio", "phone_number", "nickname_color",
        )
        read_only_fields = ("id", "username", "email", "nickname_color")

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
                "id",
                "username",
                "email",
                "first_name",
                "last_name",
                "description",
                "phone_number",
                "avatar",
                "is_email_verified",
                "email_verified_at",
                )
        read_only_fields = ("id", 
                            "username", 
                            "email",
                            "is_email_verified",
                            "email_verified_at")

class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("first_name", 
                  "last_name", 
                  "description", 
                  "phone_number", 
                  "avatar")

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username",
                  "email",
                  "password",
                  "first_name",
                  "last_name")

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
