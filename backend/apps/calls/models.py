"""Call logs for WebRTC audio/video sessions."""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class CallLog(models.Model):
    """One record per placed call, updated when the call ends."""

    class Type(models.TextChoices):
        AUDIO = "audio", "Audio"
        VIDEO = "video", "Video"

    class Status(models.TextChoices):
        RINGING = "ringing", "Ringing"
        ONGOING = "ongoing", "Ongoing"
        ENDED = "ended", "Ended"
        MISSED = "missed", "Missed"
        DECLINED = "declined", "Declined"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        "chat.ChatRoom", on_delete=models.CASCADE, related_name="calls"
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calls_made"
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="calls_participated", blank=True
    )
    call_type = models.CharField(max_length=10, choices=Type.choices, default=Type.AUDIO)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RINGING)
    started_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "calls_call_log"
        ordering = ("-started_at",)

    def __str__(self) -> str:
        return f"{self.call_type} call {self.status} ({self.id})"

    def mark_answered(self):
        self.status = self.Status.ONGOING
        self.answered_at = timezone.now()
        self.save(update_fields=["status", "answered_at"])

    def mark_ended(self, status: str = None):
        self.ended_at = timezone.now()
        reference = self.answered_at or self.started_at
        self.duration_seconds = max(int((self.ended_at - reference).total_seconds()), 0)
        self.status = status or (
            self.Status.ENDED if self.answered_at else self.Status.MISSED
        )
        self.save(update_fields=["ended_at", "duration_seconds", "status"])


class IceServer(models.Model):
    """STUN/TURN servers handed to clients before establishing a peer connection."""

    urls = models.CharField(max_length=255)
    username = models.CharField(max_length=120, blank=True, default="")
    credential = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "calls_ice_server"

    def __str__(self) -> str:
        return self.urls

    def as_dict(self) -> dict:
        payload = {"urls": self.urls}
        if self.username:
            payload["username"] = self.username
            payload["credential"] = self.credential
        return payload
