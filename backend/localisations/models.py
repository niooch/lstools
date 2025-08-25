from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimestampedModel

class Localisation(TimestampedModel):
    name = models.CharField(max_length=200, db_index=True)
    latitude = models.DecimalField(
            max_digits=9,
            decimal_places=6,
            validators=[MinValueValidator(-90), MaxValueValidator(90)]
            )
    longitude = models.DecimalField(
            max_digits=9,
            decimal_places=6,
            validators=[MinValueValidator(-180), MaxValueValidator(180)]
            )
    created_by = models.ForeignKey(
            settings.AUTH_USER_MODEL,
            on_delete=models.PROTECT,
            related_name='created_localisations',
            editable=False,
            )

    class Meta:
        indexes = [
                models.Index(fields=['name']),
                models.Index(fields=['latitude', 'longitude']),
                ]
        unique_together = [('name', 'latitude', 'longitude')]

    def __str__(self):
        return f"{self.name} ({self.latitude}, {self.longitude})"
