from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, VerificationDocument, VerificationStatus
from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

User = get_user_model()

# ---------- filters on the User changelist ----------
class UserVerificationFilter(admin.SimpleListFilter):
    title = "verification"
    parameter_name = "verification"

    def lookups(self, request, model_admin):
        return (
            ("verified_flag", "Email verified ✅"),
            ("unverified_flag", "Email not verified"),
            ("has_pending", "Has PENDING docs"),
            ("has_approved", "Has APPROVED docs"),
            ("has_rejected", "Has REJECTED docs"),
            ("no_docs", "No documents"),
        )

    def queryset(self, request, qs):
        val = self.value()
        if not val:
            return qs
        vd = VerificationDocument.objects.filter(user=OuterRef("pk"))
        if val == "verified_flag":
            return qs.filter(is_email_verified=True)
        if val == "unverified_flag":
            return qs.filter(is_email_verified=False)
        if val == "has_pending":
            return qs.annotate(x=Exists(vd.filter(status=VerificationStatus.PENDING))).filter(x=True)
        if val == "has_approved":
            return qs.annotate(x=Exists(vd.filter(status=VerificationStatus.APPROVED))).filter(x=True)
        if val == "has_rejected":
            return qs.annotate(x=Exists(vd.filter(status=VerificationStatus.REJECTED))).filter(x=True)
        if val == "no_docs":
            return qs.annotate(x=Exists(vd)).filter(x=False)
        return qs


# If User is already registered, replace it so we can add filters/columns.
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    # add/keep whatever you already show; ensure these are present:
    list_display = ("username", "email", "is_email_verified", "docs_link")
    list_filter = (UserVerificationFilter, "is_email_verified", "is_staff", "is_superuser")
    search_fields = ("username", "email")

    @admin.display(description="Documents", ordering=False)
    def docs_link(self, obj):
        # link to the VerificationDocument changelist filtered by this user
        name = f"admin:{VerificationDocument._meta.app_label}_{VerificationDocument._meta.model_name}_changelist"
        url = reverse(name) + f"?user__id__exact={obj.pk}"
        return format_html('<a href="{}">Open</a>', url)


# ---------- VerificationDocument admin ----------
@admin.action(description="Approve selected documents")
def approve_selected(modeladmin, request, queryset):
    queryset.update(status=VerificationStatus.APPROVED, reviewed_at=timezone.now())

@admin.action(description="Reject selected documents")
def reject_selected(modeladmin, request, queryset):
    queryset.update(status=VerificationStatus.REJECTED, reviewed_at=timezone.now())


@admin.register(VerificationDocument)
class VerificationDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "user_link", "kind", "status_colored", "file_link", "created_at", "reviewed_at")
    list_filter = ("status", "kind", "created_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "reviewed_at")
    actions = (approve_selected, reject_selected)
    ordering = ("-created_at",)

    @admin.display(description="User", ordering="user__username")
    def user_link(self, obj):
        name = f"admin:{User._meta.app_label}_{User._meta.model_name}_change"
        url = reverse(name, args=[obj.user_id])
        return format_html('<a href="{}">{}</a>', url, obj.user)

    @admin.display(description="File")
    def file_link(self, obj):
        if obj.file and hasattr(obj.file, "url"):
            return format_html('<a href="{}" target="_blank">Open</a>', obj.file.url)
        return "—"

    @admin.display(description="Status")
    def status_colored(self, obj):
        color = {
            VerificationStatus.PENDING: "#d97706",   # amber
            VerificationStatus.APPROVED: "#059669",  # green
            VerificationStatus.REJECTED: "#dc2626",  # red
        }.get(obj.status, "#6b7280")
        return format_html('<strong style="color:{}">{}</strong>', color, obj.get_status_display())


# ---------- "Pending verifications" dedicated page (proxy model) ----------
class PendingVerificationDocument(VerificationDocument):
    class Meta:
        proxy = True
        verbose_name = "Pending verification"
        verbose_name_plural = "Pending verifications"


@admin.register(PendingVerificationDocument)
class PendingVerificationDocumentAdmin(VerificationDocumentAdmin):
    """A separate menu entry that always shows only PENDING docs."""
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(status=VerificationStatus.PENDING)

    # Optional: make it obvious what this changelist is
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["title"] = "Pending verifications"
        return super().changelist_view(request, extra_context=extra_context)
