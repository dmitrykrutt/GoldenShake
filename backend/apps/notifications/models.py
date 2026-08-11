"""In-app notifications and device registrations."""
import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """A single in-app notification, optionally mirrored to push/e-mail."""

    class Type(models.TextChoices):
        MESSAGE = "message", "New message"
        COIN_DONATION = "coin_donation", "Coin donation"
        GARANT = "garant", "Garant deal"
        GARANT_DISPUTE = "garant_dispute", "Garant dispute"
        POST_LIKE = "post_like", "Post like"
        POST_COMMENT = "post_comment", "Post comment"
        CALL = "call", "Call"
        VERIFICATION = "verification", "Verification"
        SUPPORT = "support", "Support"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=Type.choices, default=Type.SYSTEM)
    title = models.CharField(max_length=140, blank=True, default="")
    body = models.TextField(max_length=1000, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "read", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.type} → {self.user_id}"

    def mark_read(self):
        if not self.read:
            self.read = True
            self.save(update_fields=["read"])


class DeviceToken(models.Model):
    """Firebase Cloud Messaging registration token for a user device."""

    class Platform(models.TextChoices):
        WEB = "web", "Web"
        ANDROID = "android", "Android"
        IOS = "ios", "iOS"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices, default=Platform.WEB)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_device_token"

    def __str__(self) -> str:
        return f"{self.platform} token for {self.user_id}"


class NotificationPreference(models.Model):
    """Per-user delivery channel preferences."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    telegram_enabled = models.BooleanField(default=False)
    mute_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_preference"

    def __str__(self) -> str:
        return f"prefs for {self.user_id}"
