from django.contrib import admin
from .models import VehicleType
from django.contrib import admin
from .models import VehicleType, Route, RouteStop, RoutePhoto

@admin.register(VehicleType)
class VehicleTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    list_filter = ("is_active", "category", "attribute")
    search_fields = ("name", "slug", "category", "attribute", "description")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "updated_at")

class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0
    min_num = 0
    max_num = 5
    ordering = ("order",)
    autocomplete_fields = ("localisation",)

class RoutePhotoInline(admin.TabularInline):
    model = RoutePhoto
    extra = 0
    readonly_fields = ("uploaded_by", "created_at")
    fields = ("image", "caption", "uploaded_by", "created_at")

@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "origin", "destination", "time_start", "time_end", "vehicle_type", "length_km", "price", "currency", "owner")
    list_filter  = ("vehicle_type", "crew", "status", "currency", "time_start", "time_end", "owner")
    search_fields = ("origin__name", "destination__name")
    readonly_fields = ("created_at", "updated_at")
    inlines = [RouteStopInline, RoutePhotoInline]

