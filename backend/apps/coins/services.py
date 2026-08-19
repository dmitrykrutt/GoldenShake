"""Business logic for the handshake coin economy with unique token tracking."""
from django.db import transaction

from apps.coins.models import (
    EXCHANGE_RATES,
    INVITE_REWARD_AMOUNT,
    LEVEL_ORDER,
    LEVEL_THRESHOLDS,
    RARITY_GREEN,
    RARITY_ORDER,
    CoinTransaction,
    HandshakeCoin,
    HandshakeToken,
    InviteReward,
    TokenOwnershipHistory,
)


class InsufficientCoins(Exception):
    """Raised when a user cannot cover a coin debit."""


class InvalidExchange(Exception):
    """Raised when an exchange target rarity is unknown."""


def sync_legacy_balance(user, rarity: str) -> int:
    """Keep the legacy aggregate table synchronized with active tokens."""
    count = HandshakeToken.objects.filter(
        current_owner=user, rarity=rarity, is_burned=False
    ).count()
    coin, _ = HandshakeCoin.objects.get_or_create(user=user, rarity=rarity)
    coin.amount = count
    coin.save(update_fields=["amount", "updated_at"])
    return count


def get_balance(user, rarity: str) -> int:
    return HandshakeToken.objects.filter(
        current_owner=user, rarity=rarity, is_burned=False
    ).count()


def get_balances(user) -> dict:
    balances = {}
    for rarity in RARITY_ORDER:
        balances[rarity] = HandshakeToken.objects.filter(
            current_owner=user, rarity=rarity, is_burned=False
        ).count()
    return balances


def get_unique_held_balances(user) -> dict:
    """Calculate the total number of UNIQUE tokens the user has ever possessed."""
    held = {}
    for rarity in RARITY_ORDER:
        unique_count = (
            TokenOwnershipHistory.objects.filter(user=user, token__rarity=rarity)
            .values("token_id")
            .distinct()
            .count()
        )
        held[rarity] = unique_count
    return held


@transaction.atomic
def credit(user, rarity: str, amount: int, transaction_type: str, *, from_user=None, memo: str = "", metadata=None):
    """Mint brand new unique handshake tokens to a user."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")

    tokens_created = []
    histories = []
    for _ in range(amount):
        token = HandshakeToken.objects.create(
            rarity=rarity,
            creator=from_user or user,
            current_owner=user,
            is_burned=False,
        )
        tokens_created.append(token)
        histories.append(TokenOwnershipHistory(token=token, user=user))

    TokenOwnershipHistory.objects.bulk_create(histories, ignore_conflicts=True)
    sync_legacy_balance(user, rarity)

    meta = metadata.copy() if metadata else {}
    meta["token_ids"] = [str(t.id) for t in tokens_created]

    return CoinTransaction.objects.create(
        from_user=from_user,
        to_user=user,
        amount=amount,
        rarity=rarity,
        transaction_type=transaction_type,
        memo=memo,
        metadata=meta,
    )


@transaction.atomic
def debit(user, rarity: str, amount: int, transaction_type: str, *, to_user=None, memo: str = "", metadata=None):
    """Burn or remove specific unique tokens from a user's wallet."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")

    available_tokens = list(
        HandshakeToken.objects.select_for_update()
        .filter(current_owner=user, rarity=rarity, is_burned=False)
        .order_by("created_at")[:amount]
    )

    if len(available_tokens) < amount:
        raise InsufficientCoins(
            f"Not enough {rarity} handshakes: need {amount}, have {len(available_tokens)}."
        )

    token_ids = [t.id for t in available_tokens]
    HandshakeToken.objects.filter(id__in=token_ids).update(is_burned=True, current_owner=None)
    sync_legacy_balance(user, rarity)

    meta = metadata.copy() if metadata else {}
    meta["burned_token_ids"] = [str(tid) for tid in token_ids]

    return CoinTransaction.objects.create(
        from_user=user,
        to_user=to_user,
        amount=amount,
        rarity=rarity,
        transaction_type=transaction_type,
        memo=memo,
        metadata=meta,
    )


@transaction.atomic
def transfer(sender, recipient, rarity: str, amount: int, transaction_type: str, memo: str = ""):
    """Transfer existing unique tokens from sender to recipient and record ownership."""
    if sender.id == recipient.id:
        raise ValueError("Cannot transfer to yourself.")
    if amount <= 0:
        raise ValueError("Amount must be positive.")

    tokens_to_transfer = list(
        HandshakeToken.objects.select_for_update()
        .filter(current_owner=sender, rarity=rarity, is_burned=False)
        .order_by("created_at")[:amount]
    )

    if len(tokens_to_transfer) < amount:
        raise InsufficientCoins(
            f"Not enough {rarity} handshakes: need {amount}, have {len(tokens_to_transfer)}."
        )

    token_ids = [t.id for t in tokens_to_transfer]
    HandshakeToken.objects.filter(id__in=token_ids).update(current_owner=recipient)

    histories = [TokenOwnershipHistory(token_id=tid, user=recipient) for tid in token_ids]
    TokenOwnershipHistory.objects.bulk_create(histories, ignore_conflicts=True)

    sync_legacy_balance(sender, rarity)
    sync_legacy_balance(recipient, rarity)

    CoinTransaction.objects.create(
        from_user=sender,
        to_user=recipient,
        amount=amount,
        rarity=rarity,
        transaction_type=transaction_type,
        memo=memo,
        metadata={"token_ids": [str(tid) for tid in token_ids]},
    )
    return get_balance(recipient, rarity)


@transaction.atomic
def exchange(user, target_rarity: str, count: int = 1):
    """Burn unique lower-rarity tokens to mint count unique higher-rarity tokens."""
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
        metadata={"source_rarity": source_rarity, "burned_count": required},
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
    """Resolve level by the count of UNIQUE tokens held across history."""
    unique_held = get_unique_held_balances(user)
    for level in LEVEL_ORDER:
        rule = LEVEL_THRESHOLDS[level]
        if unique_held.get(rule["rarity"], 0) >= rule["min"] and rule["min"] > 0:
            return level
    return "green"


def level_progress(user) -> dict:
    """Calculate level and remaining requirements based on unique handshakes."""
    current_balances = get_balances(user)
    unique_held = get_unique_held_balances(user)
    current = calculate_level(user)
    index = LEVEL_ORDER.index(current)
    if index == 0:
        return {"level": current, "next_level": None, "needed": 0, "balances": current_balances}
    next_level = LEVEL_ORDER[index - 1]
    rule = LEVEL_THRESHOLDS[next_level]
    needed = max(rule["min"] - unique_held.get(rule["rarity"], 0), 0)
    return {
        "level": current,
        "next_level": next_level,
        "next_rarity": rule["rarity"],
        "needed": needed,
        "balances": current_balances,
    }


def reward_invite(user_invite) -> InviteReward:
    """Grant unique green handshakes to inviter and invitee."""
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
    credit(
        user_invite.invitee,
        RARITY_GREEN,
        INVITE_REWARD_AMOUNT,
        CoinTransaction.Type.INVITE_REWARD,
        memo=f"Joined via invite from @{user_invite.inviter.username}",
        metadata={"inviter_id": str(user_invite.inviter_id)},
    )
    reward = InviteReward.objects.create(
        user_invite=user_invite, amount=INVITE_REWARD_AMOUNT, rarity=RARITY_GREEN, transaction=tx
    )
    user_invite.rewarded = True
    user_invite.save(update_fields=["rewarded"])
    return reward
