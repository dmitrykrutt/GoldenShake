"""Chat domain: rooms, encrypted messages, locked files and pinned chats."""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.chat.encryption import decrypt_message, encrypt_message


class ChatRoom(models.Model):
    """A direct, group, support or guarantee-deal conversation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=120, blank=True, default="")
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="chat_rooms", through="RoomMembership"
    )
    is_group = models.BooleanField(default=False)
    is_support = models.BooleanField(default=False)
    is_garant_chat = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to="room_avatars/", blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_rooms",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_room"
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return self.title or f"room:{self.id}"

    def display_title_for(self, user) -> str:
        if self.title:
            return self.title
        other = self.participants.exclude(pk=user.pk).first()
        return other.username if other else "Saved messages"

    def has_participant(self, user) -> bool:
        return self.participants.filter(pk=user.pk).exists()


class RoomMembership(models.Model):
    """Through-model holding per-user room state."""

    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        ADMIN = "admin", "Admin"
        SUPPORT = "support", "Support agent"

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="room_memberships"
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MEMBER)
    muted = models.BooleanField(default=False)
    last_read_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_room_membership"
        unique_together = ("room", "user")

    def __str__(self) -> str:
        return f"{self.user_id}@{self.room_id}"


class Message(models.Model):
    """An encrypted message. ``content`` always stores ciphertext."""

    class Type(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        FILE = "file", "File"
        COIN_DONATION = "coin_donation", "Coin donation"
        LOCKED_FILE = "locked_file", "Locked file"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="messages",
    )
    content = models.BinaryField(blank=True, default=b"")
    message_type = models.CharField(max_length=20, choices=Type.choices, default=Type.TEXT)
    media = models.FileField(upload_to="chat_media/", blank=True, null=True)
    media_meta = models.JSONField(default=dict, blank=True)
    reply_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )
    deleted_for_all = models.BooleanField(default=False)
    deleted_for_self_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="hidden_messages"
    )
    is_pinned = models.BooleanField(default=False)
    read_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="read_messages"
    )
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_message"
        ordering = ("created_at",)
        indexes = [models.Index(fields=["room", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.message_type} from {self.sender_id} in {self.room_id}"

    # -- plaintext helpers -------------------------------------------------
    @property
    def plaintext(self) -> str:
        if self.deleted_for_all:
            return ""
        return decrypt_message(self.content)

    def set_plaintext(self, value: str) -> None:
        self.content = encrypt_message(value or "")

    def visible_to(self, user) -> bool:
        if self.deleted_for_all:
            return False
        return not self.deleted_for_self_users.filter(pk=user.pk).exists()

    def soft_delete(self, user, for_all: bool = False) -> None:
        if for_all and self.sender_id == user.id:
            self.deleted_for_all = True
            self.content = b""
            self.save(update_fields=["deleted_for_all", "content"])
        else:
            self.deleted_for_self_users.add(user)


class LockedFile(models.Model):
    """A pay-to-unlock attachment priced in handshake coins."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.OneToOneField(
        Message, on_delete=models.CASCADE, related_name="locked_file"
    )
    price_amount = models.PositiveIntegerField(default=1)
    price_rarity = models.CharField(max_length=16, default="green")
    unlocked_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="unlocked_files"
    )
    preview_text = models.CharField(max_length=140, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_locked_file"

    def __str__(self) -> str:
        return f"locked file {self.price_amount} {self.price_rarity}"

    def is_unlocked_for(self, user) -> bool:
        if self.message.sender_id == user.id:
            return True
        return self.unlocked_by.filter(pk=user.pk).exists()


class PinnedChat(models.Model):
    """User-specific chat pinning with explicit ordering."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pinned_chats"
    )
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="pins")
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_pinned_chat"
        unique_together = ("user", "room")
        ordering = ("order", "-created_at")

    def __str__(self) -> str:
        return f"pin {self.room_id} for {self.user_id}"


class SupportTicket(models.Model):
    """Support conversations surfaced in the admin panel queue."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.OneToOneField(ChatRoom, on_delete=models.CASCADE, related_name="ticket")
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_tickets"
    )
    subject = models.CharField(max_length=200)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "chat_support_ticket"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"[{self.status}] {self.subject}"

    def close(self):
        self.status = self.Status.CLOSED
        self.closed_at = timezone.now()
        self.save(update_fields=["status", "closed_at"])
