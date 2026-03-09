from rest_framework import permissions


class IsEmailVerified(permissions.BasePermission):
    message = "Email not verified. Verify your email to continue."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or getattr(user, "is_email_verified", False))
        )


class IsFullyVerified(permissions.BasePermission):
    message = "Approved verification documents are required to access transport tools."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or getattr(user, "is_fully_verified", False))
        )
