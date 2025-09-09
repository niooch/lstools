from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
import colorsys, hashlib

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
    def save(self, *args, **kwargs):
        if not self.nickname_color:
            seed = str(self.pk) if self.pk else self.username or self.email or "default"
            self.nickname_color = _default_nickname_color(seed)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username or self.email


