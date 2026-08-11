"""Moderation audit trail."""
import uuid

from django.conf import settings
from django.db import models


class AdminAction(models.Model):
    """Every staff action is recorded for accountability."""

    class Action(models.TextChoices):
        VERIFY_USER = "verify_user", "Verified user"
        REJECT_VERIFICATION = "reject_verification", "Rejected verification"
        BAN_USER = "ban_user", "Banned user"
        UNBAN_USER = "unban_user", "Unbanned user"
        RESOLVE_DISPUTE = "resolve_dispute", "Resolved dispute"
        CLOSE_TICKET = "close_ticket", "Closed support ticket"
        GRANT_COINS = "grant_coins", "Granted coins"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="admin_actions"
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    target_type = models.CharField(max_length=64, blank=True, default="")
    target_id = models.CharField(max_length=64, blank=True, default="")
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_panel_action"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.action} by {self.actor_id}"


class BannedUser(models.Model):
    """Bans issued by the moderation team."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ban"
    )
    reason = models.TextField(max_length=2000)
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="bans_issued"
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_panel_banned_user"

    def __str__(self) -> str:
        return f"ban {self.user_id}"
