from django.db import models
from django.conf import settings
from core.models import TimestampedModel
from django.utils import timezone

class Message(TimestampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages")
    content = models.TextField()
    route = models.ForeignKey("transports.Route", null=True, blank=True, on_delete=models.SET_NULL, related_name="chat_messages")
    deleted_at = models.DateTimeField(null=True, blank=True)
    image = models.ImageField(upload_to="chat/%Y/%m", null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        indexes = [
                models.Index(fields=["route"]),
                models.Index(fields=["created_at"]),
                ]

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])
