"""Accounts domain models: users, invites, e-mail confirmations and TOTP."""
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.accounts.validators import validate_email_domain

def generate_invite_token() -> str:
    """Return a URL-safe, unguessable invite token."""
    return secrets.token_urlsafe(24)

def generate_numeric_code(length: int = 6) -> str:
    """Return a cryptographically strong numeric confirmation code."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))

class UserManager(BaseUserManager):
    """Manager that handles optional e-mail and username-based accounts."""

    use_in_migrations = True

    def _create_user(self, email, username, password, **extra_fields):

        if not username:
            raise ValueError("Users must provide a username.")
        email = self.normalize_email(email).lower() if email else None
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"], validate_unique=False)
        user.save(using=self._db)
        return user

    def create_user(self, email=None, username=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, username, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("is_email_confirmed", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, username, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    """Primary account entity for GoldenShake."""

    class Theme(models.TextChoices):
        MIDNIGHT = "midnight", "Midnight"
        GOLDEN = "golden", "Golden Hour"
        EMERALD = "emerald", "Emerald"
        CRIMSON = "crimson", "Crimson"
        OCEAN = "ocean", "Ocean"
        SAKURA = "sakura", "Sakura"
        GRAPHITE = "graphite", "Graphite"
        AURORA = "aurora", "Aurora"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(
        unique=True, null=True, blank=True, validators=[validate_email_domain]
    )
    username = models.CharField(max_length=32, unique=True)
    phone = models.CharField(max_length=20, blank=True, default="")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_confirmed = models.BooleanField(default=False)
    # Blue-check style verification granted by the moderation team.
    is_verified = models.BooleanField(default=False)

    totp_secret = models.CharField(max_length=64, blank=True, default="")
    totp_enabled = models.BooleanField(default=False)

    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True, default="")
    social_links = models.JSONField(default=dict, blank=True)
    theme_color = models.CharField(
        max_length=16, choices=Theme.choices, default=Theme.MIDNIGHT
    )

    private_profile = models.BooleanField(default=False)
    paid_messages_enabled = models.BooleanField(default=False)
    paid_message_price = models.PositiveIntegerField(default=0)
    newsletter_opt_in = models.BooleanField(default=False)

    is_18_confirmed = models.BooleanField(default=False)
    tos_confirmed = models.BooleanField(default=False)
    gdpr_data_requested = models.BooleanField(default=False)
    gdpr_data_requested_at = models.DateTimeField(null=True, blank=True)

    telegram_chat_id = models.CharField(max_length=64, blank=True, default="")
    fcm_token = models.CharField(max_length=255, blank=True, default="")

    public_key = models.CharField(
        max_length=128, blank=True, default="", help_text="Base64 NaCl public key."
    )

    last_seen = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "accounts_user"
        ordering = ("-date_joined",)
        indexes = [
            models.Index(fields=["username"]),
            models.Index(fields=["phone"]),
        ]

    def __str__(self) -> str:
        return f"{self.username} <{self.email or 'no-email'}>"

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower().strip()
        else:
            self.email = None
        super().save(*args, **kwargs)

    @property
    def handshake_level(self) -> str:
        """Current handshake level derived from the user's coin balances."""
        from apps.coins.services import calculate_level

        return calculate_level(self)

    def mark_seen(self, online: bool = True) -> None:
        self.is_online = online
        self.last_seen = timezone.now()
        self.save(update_fields=["is_online", "last_seen"])

class InviteLink(models.Model):
    """Invite links are the only way to join GoldenShake."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="invite_links"
    )
    hash_token = models.CharField(max_length=64, unique=True, default=generate_invite_token)
    max_uses = models.PositiveIntegerField(default=5)
    use_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_invite_link"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"invite:{self.hash_token[:8]}… by {self.creator_id}"

    @property
    def uses_left(self) -> int:
        return max(self.max_uses - self.use_count, 0)

    def is_usable(self) -> bool:
        if not self.is_active or self.uses_left <= 0:
            return False
        if self.expires_at and self.expires_at <= timezone.now():
            return False
        return True

    def consume(self) -> None:
        self.use_count += 1
        if self.use_count >= self.max_uses:
            self.is_active = False
        self.save(update_fields=["use_count", "is_active"])

class UserInvite(models.Model):
    """Records the inviter → invitee relation used for coin rewards."""

    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invites"
    )
    invitee = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="invited_by"
    )
    invite_link = models.ForeignKey(
        InviteLink, on_delete=models.SET_NULL, null=True, related_name="uses"
    )
    rewarded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_user_invite"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.inviter_id} → {self.invitee_id}"

class EmailConfirmation(models.Model):
    """Single-use 6-digit e-mail OTP for registration and login."""

    class Purpose(models.TextChoices):
        REGISTRATION = "registration", "Registration"
        LOGIN = "login", "Login"
        RECOVERY = "recovery", "Recovery"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_codes"
    )
    code = models.CharField(max_length=6, default=generate_numeric_code)
    purpose = models.CharField(
        max_length=16, choices=Purpose.choices, default=Purpose.REGISTRATION
    )
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_email_confirmation"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user_id} {self.purpose} ({'used' if self.is_used else 'pending'})"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(
                minutes=getattr(settings, "EMAIL_CODE_TTL_MINUTES", 15)
            )
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        return not self.is_used and self.attempts < 5 and self.expires_at > timezone.now()

    def consume(self) -> None:
        self.is_used = True
        self.save(update_fields=["is_used"])

class TOTPDevice(models.Model):
    """Authenticator-app device bound to a user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="totp_device"
    )
    secret = models.CharField(max_length=64)
    confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_totp_device"

    def __str__(self) -> str:
        return f"TOTP for {self.user_id} ({'confirmed' if self.confirmed else 'pending'})"

class VerificationRequest(models.Model):
    """Request for the golden verification badge, reviewed by staff."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="verification_requests",
    )
    reason = models.TextField(max_length=2000)
    proof_url = models.URLField(blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    reviewer_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_verification_request"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"verification({self.user_id}) = {self.status}"
