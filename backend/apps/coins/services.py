"""Business logic for the handshake coin economy."""
from django.db import transaction
from django.db.models import F

from apps.coins.models import (
    EXCHANGE_RATES,
    INVITE_REWARD_AMOUNT,
    LEVEL_ORDER,
    LEVEL_THRESHOLDS,
    RARITY_GREEN,
    RARITY_ORDER,
    CoinTransaction,
    HandshakeCoin,
    InviteReward,
)


class InsufficientCoins(Exception):
    """Raised when a user cannot cover a coin debit."""


class InvalidExchange(Exception):
    """Raised when an exchange target rarity is unknown."""


def get_balance(user, rarity: str) -> int:
    coin = HandshakeCoin.objects.filter(user=user, rarity=rarity).first()
    return coin.amount if coin else 0


def get_balances(user) -> dict:
    balances = {rarity: 0 for rarity in RARITY_ORDER}
    for coin in HandshakeCoin.objects.filter(user=user):
        balances[coin.rarity] = coin.amount
    return balances


@transaction.atomic
def credit(user, rarity: str, amount: int, transaction_type: str, *, from_user=None, memo: str = "", metadata=None):
    """Add coins to a user's balance and write a ledger entry."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    coin, _ = HandshakeCoin.objects.select_for_update().get_or_create(
        user=user, rarity=rarity, defaults={"amount": 0}
    )
    coin.amount = F("amount") + amount
    coin.save(update_fields=["amount", "updated_at"])
    coin.refresh_from_db()
    return CoinTransaction.objects.create(
        from_user=from_user,
        to_user=user,
        amount=amount,
        rarity=rarity,
        transaction_type=transaction_type,
        memo=memo,
        metadata=metadata or {},
    )


@transaction.atomic
def debit(user, rarity: str, amount: int, transaction_type: str, *, to_user=None, memo: str = "", metadata=None):
    """Remove coins from a user's balance and write a ledger entry."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    coin = (
        HandshakeCoin.objects.select_for_update()
        .filter(user=user, rarity=rarity)
        .first()
    )
    if coin is None or coin.amount < amount:
        raise InsufficientCoins(
            f"Not enough {rarity} handshakes: need {amount}, have {coin.amount if coin else 0}."
        )
    coin.amount = F("amount") - amount
    coin.save(update_fields=["amount", "updated_at"])
    coin.refresh_from_db()
    return CoinTransaction.objects.create(
        from_user=user,
        to_user=to_user,
        amount=amount,
        rarity=rarity,
        transaction_type=transaction_type,
        memo=memo,
        metadata=metadata or {},
    )


@transaction.atomic
def transfer(sender, recipient, rarity: str, amount: int, transaction_type: str, memo: str = ""):
    """Move coins between two users (donations, paid messages, unlocks)."""
    debit(sender, rarity, amount, transaction_type, to_user=recipient, memo=memo)
    coin, _ = HandshakeCoin.objects.select_for_update().get_or_create(
        user=recipient, rarity=rarity, defaults={"amount": 0}
    )
    coin.amount = F("amount") + amount
    coin.save(update_fields=["amount", "updated_at"])
    coin.refresh_from_db()
    return coin.amount


@transaction.atomic
def exchange(user, target_rarity: str, count: int = 1):
    """Burn lower-rarity coins to mint ``count`` coins of ``target_rarity``."""
    rule = EXCHANGE_RATES.get(target_rarity)
    if rule is None:
        raise InvalidExchange(f"'{target_rarity}' cannot be minted through exchange.")
    if count <= 0:
        raise ValueError("Count must be positive.")

    source_rarity = rule["from"]
    required = rule["amount"] * count

    debit(
        user,
        source_rarity,
        required,
        CoinTransaction.Type.EXCHANGE_BURN,
        memo=f"Exchange {required} {source_rarity} → {count} {target_rarity}",
        metadata={"target_rarity": target_rarity, "count": count},
    )
    mint_tx = credit(
        user,
        target_rarity,
        count,
        CoinTransaction.Type.EXCHANGE_MINT,
        memo=f"Minted {count} {target_rarity}",
        metadata={"source_rarity": source_rarity, "burned": required},
    )
    return {
        "target_rarity": target_rarity,
        "minted": count,
        "burned": required,
        "burned_rarity": source_rarity,
        "transaction_id": str(mint_tx.id),
        "balances": get_balances(user),
    }


def calculate_level(user) -> str:
    """Resolve the highest handshake level the user's balances satisfy."""
    balances = get_balances(user)
    for level in LEVEL_ORDER:
        rule = LEVEL_THRESHOLDS[level]
        if balances.get(rule["rarity"], 0) >= rule["min"] and rule["min"] > 0:
            return level
    return "green"


def level_progress(user) -> dict:
    """Return the current level plus what is needed for the next one."""
    balances = get_balances(user)
    current = calculate_level(user)
    index = LEVEL_ORDER.index(current)
    if index == 0:
        return {"level": current, "next_level": None, "needed": 0, "balances": balances}
    next_level = LEVEL_ORDER[index - 1]
    rule = LEVEL_THRESHOLDS[next_level]
    needed = max(rule["min"] - balances.get(rule["rarity"], 0), 0)
    return {
        "level": current,
        "next_level": next_level,
        "next_rarity": rule["rarity"],
        "needed": needed,
        "balances": balances,
    }


def reward_invite(user_invite) -> InviteReward:
    """Grant the inviter green handshakes for a successful invite (idempotent)."""
    reward = InviteReward.objects.filter(user_invite=user_invite).first()
    if reward is not None:
        return reward
    tx = credit(
        user_invite.inviter,
        RARITY_GREEN,
        INVITE_REWARD_AMOUNT,
        CoinTransaction.Type.INVITE_REWARD,
        memo=f"Invited @{user_invite.invitee.username}",
        metadata={"invitee_id": str(user_invite.invitee_id)},
    )
    reward = InviteReward.objects.create(
        user_invite=user_invite, amount=INVITE_REWARD_AMOUNT, rarity=RARITY_GREEN, transaction=tx
    )
    user_invite.rewarded = True
    user_invite.save(update_fields=["rewarded"])
    return reward
