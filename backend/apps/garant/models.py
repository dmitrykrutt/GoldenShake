"""Escrow ("garant") deals paid in crypto through CryptoPay."""
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_deal_token() -> str:
    return secrets.token_urlsafe(20)


class GarantDeal(models.Model):
    """A guaranteed deal between a seller (creator) and a buyer."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        AWAITING_BUYER = "awaiting_buyer", "Awaiting buyer"
        AWAITING_PAYMENT = "awaiting_payment", "Awaiting payment"
        PAID = "paid", "Paid (funds held)"
        COMPLETED_BY_SELLER = "completed_by_seller", "Marked complete by seller"
        CONFIRMED = "confirmed", "Confirmed by buyer"
        RELEASED = "released", "Funds released"
        DISPUTED = "disputed", "Disputed"
        REFUNDED = "refunded", "Refunded"
        CANCELLED = "cancelled", "Cancelled"

    class Currency(models.TextChoices):
        USDT = "USDT", "USDT"
        TON = "TON", "TON"
        BTC = "BTC", "BTC"
        ETH = "ETH", "ETH"
        LTC = "LTC", "LTC"
        TRX = "TRX", "TRX"
        BNB = "BNB", "BNB"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="garant_deals_created"
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="garant_deals_bought",
    )
    title = models.CharField(max_length=140)
    description = models.TextField(max_length=5000)
    price_crypto = models.DecimalField(max_digits=20, decimal_places=8)
    crypto_currency = models.CharField(
        max_length=10, choices=Currency.choices, default=Currency.USDT
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.AWAITING_BUYER)
    private_link_token = models.CharField(
        max_length=64, unique=True, default=generate_deal_token
    )
    platform_fee_pct = models.PositiveSmallIntegerField(default=5)
    room = models.OneToOneField(
        "chat.ChatRoom",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="garant_deal",
    )
    buyer_agreed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "garant_deal"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.platform_fee_pct:
            self.platform_fee_pct = getattr(settings, "GARANT_PLATFORM_FEE_PCT", 5)
        super().save(*args, **kwargs)

    @property
    def platform_fee(self):
        return (self.price_crypto * self.platform_fee_pct) / 100

    @property
    def seller_payout(self):
        return self.price_crypto - self.platform_fee

    @property
    def private_url(self) -> str:
        return f"{settings.FRONTEND_URL.rstrip('/')}/garant/{self.private_link_token}"

    def is_participant(self, user) -> bool:
        return user.id in {self.creator_id, self.buyer_id}

    def mark_paid(self):
        self.status = self.Status.PAID
        self.save(update_fields=["status", "updated_at"])

    def mark_completed(self):
        self.status = self.Status.COMPLETED_BY_SELLER
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "updated_at"])

    def confirm(self):
        self.status = self.Status.CONFIRMED
        self.confirmed_at = timezone.now()
        self.save(update_fields=["status", "confirmed_at", "updated_at"])

    def release(self):
        self.status = self.Status.RELEASED
        self.released_at = timezone.now()
        self.save(update_fields=["status", "released_at", "updated_at"])


class GarantPayment(models.Model):
    """A CryptoPay invoice attached to a deal."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        EXPIRED = "expired", "Expired"
        REFUNDED = "refunded", "Refunded"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey(GarantDeal, on_delete=models.CASCADE, related_name="payments")
    cryptopay_invoice_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    pay_url = models.URLField(blank=True, default="")
    amount = models.DecimalField(max_digits=20, decimal_places=8)
    currency = models.CharField(max_length=10, default="USDT")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    raw_payload = models.JSONField(default=dict, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "garant_payment"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"invoice {self.cryptopay_invoice_id or self.id} ({self.status})"

    def mark_paid(self, payload=None):
        self.status = self.Status.PAID
        self.paid_at = timezone.now()
        if payload:
            self.raw_payload = payload
        self.save(update_fields=["status", "paid_at", "raw_payload"])


class GarantDispute(models.Model):
    """A complaint escalated to the moderation team."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWING = "reviewing", "Reviewing"
        RESOLVED_BUYER = "resolved_buyer", "Resolved for buyer"
        RESOLVED_SELLER = "resolved_seller", "Resolved for seller"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey(GarantDeal, on_delete=models.CASCADE, related_name="disputes")
    complainant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="garant_disputes"
    )
    description = models.TextField(max_length=5000)
    evidence_url = models.URLField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    resolution_note = models.TextField(blank=True, default="")
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="garant_disputes_resolved",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "garant_dispute"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"dispute on {self.deal_id} ({self.status})"
