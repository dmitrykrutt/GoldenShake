"""Handshake coin economy: rarities, balances, transactions and exchange rules."""
import uuid

from django.conf import settings
from django.db import models

RARITY_GREEN = "green"
RARITY_BLUE = "blue"
RARITY_PURPLE = "purple"
RARITY_RED = "red"
RARITY_GOLD = "gold"

RARITY_CHOICES = (
    (RARITY_GREEN, "Green Handshake"),
    (RARITY_BLUE, "Blue Handshake"),
    (RARITY_PURPLE, "Purple Handshake"),
    (RARITY_RED, "Red Handshake"),
    (RARITY_GOLD, "Gold Handshake"),
)

RARITY_ORDER = [RARITY_GREEN, RARITY_BLUE, RARITY_PURPLE, RARITY_RED, RARITY_GOLD]

# How many coins of the lower rarity are burned to mint one of the higher rarity.
EXCHANGE_RATES = {
    "blue": {"from": "green", "amount": 50},
    "purple": {"from": "blue", "amount": 10},
    "red": {"from": "purple", "amount": 10},
    "gold": {"from": "red", "amount": 10},
}

# Level ladder. Each entry: the rarity bucket that is counted and the minimum
# amount of that rarity required to hold the level.
LEVEL_THRESHOLDS = {
    "green": {"rarity": RARITY_GREEN, "min": 0},
    "green_plus": {"rarity": RARITY_GREEN, "min": 100},
    "blue": {"rarity": RARITY_BLUE, "min": 1},
    "blue_plus": {"rarity": RARITY_BLUE, "min": 25},
    "purple": {"rarity": RARITY_PURPLE, "min": 1},
    "purple_plus": {"rarity": RARITY_PURPLE, "min": 25},
    "red": {"rarity": RARITY_RED, "min": 1},
    "red_plus": {"rarity": RARITY_RED, "min": 25},
    "gold": {"rarity": RARITY_GOLD, "min": 1},
    "gold_plus": {"rarity": RARITY_GOLD, "min": 10},
}

# Ordered from the highest to the lowest level for resolution.
LEVEL_ORDER = [
    "gold_plus",
    "gold",
    "red_plus",
    "red",
    "purple_plus",
    "purple",
    "blue_plus",
    "blue",
    "green_plus",
    "green",
]

# Coins granted for platform actions.
INVITE_REWARD_AMOUNT = 10
DAILY_ACTIVITY_REWARD = 1


class HandshakeCoin(models.Model):
    """A user's balance for one coin rarity."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coins"
    )
    rarity = models.CharField(max_length=16, choices=RARITY_CHOICES, default=RARITY_GREEN)
    amount = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "coins_handshake_coin"
        unique_together = ("user", "rarity")
        ordering = ("user", "rarity")

    def __str__(self) -> str:
        return f"{self.user_id}: {self.amount} {self.rarity}"


class CoinTransaction(models.Model):
    """Immutable ledger entry for every coin movement."""

    class Type(models.TextChoices):
        INVITE_REWARD = "invite_reward", "Invite reward"
        DONATION = "donation", "Donation"
        EXCHANGE_BURN = "exchange_burn", "Exchange burn"
        EXCHANGE_MINT = "exchange_mint", "Exchange mint"
        PAID_MESSAGE = "paid_message", "Paid message"
        FILE_UNLOCK = "file_unlock", "Locked file unlock"
        ADMIN_GRANT = "admin_grant", "Admin grant"
        ACTIVITY = "activity", "Activity reward"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coin_transactions_sent",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coin_transactions_received",
    )
    amount = models.PositiveIntegerField()
    rarity = models.CharField(max_length=16, choices=RARITY_CHOICES)
    transaction_type = models.CharField(max_length=32, choices=Type.choices)
    memo = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "coins_transaction"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["from_user", "-created_at"]),
            models.Index(fields=["to_user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.transaction_type}: {self.amount} {self.rarity}"


class InviteReward(models.Model):
    """Guard record ensuring an invite is only rewarded once."""

    user_invite = models.OneToOneField(
        "accounts.UserInvite", on_delete=models.CASCADE, related_name="reward"
    )
    amount = models.PositiveIntegerField(default=INVITE_REWARD_AMOUNT)
    rarity = models.CharField(max_length=16, choices=RARITY_CHOICES, default=RARITY_GREEN)
    transaction = models.ForeignKey(
        CoinTransaction, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "coins_invite_reward"

    def __str__(self) -> str:
        return f"invite reward {self.amount} {self.rarity}"
