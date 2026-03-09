from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
import colorsys, hashlib
from uuid import uuid4
from django.utils import timezone
from core.models import TimestampedModel

HEX_COLOR=RegexValidator(
        r"^#[0-9A-Fa-f]{6}$",
        "Enter a valid hex color code, e.g. #RRGGBB."
        )

def _default_nickname_color(seed: str) -> str:
    h = int(hashlib.sha1(seed.encode("utf-8")).hexdigest(), 16) % 360
    r, g, b = colorsys.hls_to_rgb(h / 360, 0.55, 0.65)
    return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"

phone_validator = RegexValidator(
        regex=r'^\+?[0-9\s\-\(\)\.]{7,}$',
        message="Enter a valid phone number."
        )

class User(AbstractUser):
    #pola do tabeli uzytkownikow
    email = models.EmailField(unique=True, db_index=True)

    description = models.TextField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    avatar = models.URLField(blank=True)
    #weryfikacja email
    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    nickname_color = models.CharField(max_length=7, validators=[HEX_COLOR], default="", blank=True)
    bio = models.TextField(blank=True)
    display_name = models.CharField(max_length=100, blank=True)
    def save(self, *args, **kwargs):
        if not self.nickname_color:
            seed = str(self.pk) if self.pk else self.username or self.email or "default"
            self.nickname_color = _default_nickname_color(seed)
        super().save(*args, **kwargs)

    @property
    def has_approved_verification(self):
        if self.is_staff:
            return True
        if not self.pk:
            return False
        return self.verification_docs.filter(status=VerificationStatus.APPROVED).exists()

    @property
    def is_fully_verified(self):
        if self.is_staff:
            return True
        return bool(self.is_email_verified and self.has_approved_verification)

    def __str__(self):
        return self.username or self.email

def verification_upload_to(instance, filename):
    ext = (filename.rsplit(".", 1)[-1] or "").lower()
    return f"verification/{instance.user_id}/{timezone.now():%Y/%m}/{uuid4().hex}.{ext}"

class VerificationKind(models.TextChoices):
    ID = "id", "ID/Passport"
    COMPANY = "company", "Company Document"
    LICENSE = "license", "License"
    OTHER = "other", "Other"

class VerificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"

class VerificationDocument(TimestampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_docs")
    kind = models.CharField(max_length=16, choices=VerificationKind.choices, default=VerificationKind.OTHER)
    file = models.FileField(upload_to=verification_upload_to)
    status = models.CharField(max_length=12, choices=VerificationStatus.choices, default=VerificationStatus.PENDING, db_index=True)
    admin_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="verification_reviews")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status", "created_at"])]
