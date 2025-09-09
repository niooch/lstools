from django.contrib import admin
from .models import Message

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "short", "route", "created_at", "deleted_at")
    list_filter = ("deleted_at",)
    search_fields = ("content", "user__username")

    def short(self, obj): return (obj.content or "")[:80]
