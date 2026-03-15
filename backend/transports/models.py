from django.db import models
from django.utils.text import slugify
from core.models import TimestampedModel
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from uuid import uuid4

def route_photo_upload_to(instance, filename):
    ext = (filename.rsplit(".", 1)[-1] or "").lower()
    return f"routes/{instance.route_id}/{timezone.now():%Y/%m}/{uuid4().hex}.{ext}"

class RoutePhoto(TimestampedModel):
    route = models.ForeignKey("transports.Route", on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=route_photo_upload_to)
    caption = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="route_photos")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["route", "created_at"])]

class RouteStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    SOLD = "sold", "Sold"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"

class CrewType(models.TextChoices):
    SINGLE = "single", "Single crew"
    DOUBLE = "double", "Double crew"

class Currency(models.TextChoices):
    EUR = "EUR", "Euro"

class VehicleType(TimestampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    category = models.CharField(max_length=64, blank=True)
    attribute = models.CharField(max_length=1, blank=True, db_index=True,
                                 help_text="Single character attribute for filtering, e.g. 'R', 'P'")

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["name"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:140]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Route(TimestampedModel):
    owner = models.ForeignKey(
            settings.AUTH_USER_MODEL,
            on_delete=models.CASCADE,
            related_name="routes"
            )
    origin = models.ForeignKey(
            "localisations.Localisation",
            on_delete=models.PROTECT, 
            related_name="route_from"
            )
    destination = models.ForeignKey(
            "localisations.Localisation",
            on_delete=models.PROTECT,
            related_name="route_to"
            )

    time_start = models.DateTimeField()
    time_end = models.DateTimeField()

    vehicle_type = models.ForeignKey(
            "transports.VehicleType",
            on_delete=models.PROTECT,
            related_name="routes"
            )
    length_km = models.DecimalField(
            max_digits=8,
            decimal_places=2,
            null=True,
            blank=True,
            validators=[MinValueValidator(Decimal("0"))]
            )
    price = models.DecimalField(
            max_digits=10,
            decimal_places=2,
            null=True,
            blank=True,
            validators=[MinValueValidator(Decimal("0"))]
            )

    currency = models.CharField(
            max_length=3,
            choices=Currency.choices,
            default=Currency.EUR,
            db_index=True
            )
    status = models.CharField(
            max_length=20,
            choices=RouteStatus.choices,
            default=RouteStatus.ACTIVE,
            db_index=True
            )
    sold_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    crew = models.CharField(max_length=10,
                            choices=CrewType.choices,
                            default=CrewType.SINGLE,
                            db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["time_start"]),
            models.Index(fields=["time_end"]),
            models.Index(fields=["vehicle_type"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["origin"]),
            models.Index(fields=["destination"]),
            models.Index(fields=["crew"]),
            ]
        ordering = ["-time_start"]
    
    def mark_sold(self):
        self.status = RouteStatus.SOLD
        self.sold_at = timezone.now()
        self.save(update_fields=["status", "sold_at", "updated_at"])

    def mark_cancelled(self):
        self.status = RouteStatus.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])

    def clean(self):
        super().clean()
        if self.time_end and self.time_start and self.time_end < self.time_start:
            raise ValidationError({"time_end": "End time must be after start time."})
    def __str__(self):
        return f"{self.origin} to {self.destination} by {self.owner} ({self.time_start} - {self.time_end})"

class RouteStop(TimestampedModel):
    """
    Up to 5 intermediate stops between origin and destination, in order.
    """
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="stops")
    order = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], help_text="1..5")
    localisation = models.ForeignKey("localisations.Localisation", on_delete=models.PROTECT, related_name="route_stops")

    class Meta:
        unique_together = (("route", "order"),)
        ordering = ["order"]
        indexes = [
                models.Index(fields=["route", "order"]),
                ]

    def __str__(self):
        return f"{self.route_id}#{self.order} → {self.localisation}"
