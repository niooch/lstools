from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
            (None, {"fields": ("username", "password")}),
            ("Personal info", {"fields": ("first_name", "last_name", "email", "description", "phone_number", "avatar")}),
            ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
            ("Important dates", {"fields": ("last_login", "date_joined")}),
            )
    add_fieldsets = (
            (None, {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2"),
                }),
            )
    list_display = ("id", "username", "email", "nickname_color", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    readonly_fields = ("last_login", "date_joined", "is_email_verified", "email_verified_at", "nickname_color")
    ordering = ("id",)


