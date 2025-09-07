from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner_id == request.user.id or request.user.is_staff

class IsEmailVerifiedOrReadOnly(permissions.BasePermission):
    message = "Email not verified. Verify your email to create or modify routes."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(
                user
                and user.is_authenticated
                and (user.is_staff or getattr(user, "is_email_verified", False))
                )
