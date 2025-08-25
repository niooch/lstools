from django.contrib import admin
from django.http import HttpResponseForbidden
from django.template.response import TemplateResponse
from django.urls import path, reverse
from .models import Localisation
from .services import nominatim_search

@admin.register(Localisation)
class LocalisationAdmin(admin.ModelAdmin):
    change_list_template = "admin/localisation/change_list.html"
    list_display = ("id", "name", "latitude", "longitude", "created_by", "created_at")
    search_fields = ("name",)
    list_filter = ("created_at",)
    readonly_fields = ("created_by", "created_at", "updated_at")

    def has_add_permission(self, request):
        # only superusers can add via admin
        return request.user.is_superuser

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def get_changeform_initial_data(self, request):
        """
        Prefill add form when coming from Nominatim picker.
        """
        initial = super().get_changeform_initial_data(request)
        # From querystring: ?name=...&latitude=...&longitude=...
        for key in ("name", "latitude", "longitude"):
            if key in request.GET:
                initial[key] = request.GET.get(key)
        return initial

    # ----- Custom admin views -----
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "nominatim/",
                self.admin_site.admin_view(self.nominatim_lookup_view),
                name="localisations_localisation_nominatim",
            ),
        ]
        return custom + urls

    def nominatim_lookup_view(self, request):
        if not request.user.is_superuser:
            return HttpResponseForbidden("Superuser only.")

        q = request.GET.get("q", "").strip()
        limit = int(request.GET.get("limit", "10") or 10)
        results = nominatim_search(q, limit) if q else []

        add_url_base = reverse("admin:localisations_localisation_add")  # /admin/geo/localisation/add/
        context = dict(
            self.admin_site.each_context(request),
            title="Lookup via Nominatim",
            q=q,
            limit=limit,
            results=results,
            add_url_base=add_url_base,
        )
        return TemplateResponse(request, "admin/localisation/nominatim_search.html", context)
