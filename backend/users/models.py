from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

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

    def __str__(self):
        return self.username or self.email


