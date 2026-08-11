"""Celery tasks for asynchronous coin operations."""
import logging

from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@shared_task(name="coins.process_exchange")
def process_coin_exchange_task(user_id: str, target_rarity: str, count: int = 1):
    """Run a coin exchange in the background (used for bulk conversions)."""
    from apps.coins.services import InsufficientCoins, InvalidExchange, exchange
    from apps.notifications.services import notify

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"ok": False, "error": "user_not_found"}

    try:
        result = exchange(user, target_rarity, count)
    except (InsufficientCoins, InvalidExchange) as exc:
        notify(user, "system", title="Exchange failed", body=str(exc), data={})
        return {"ok": False, "error": str(exc)}

    notify(
        user,
        "system",
        title="Exchange complete",
        body=f"You minted {result['minted']} {target_rarity} handshakes.",
        data=result,
    )
    return {"ok": True, **{k: v for k, v in result.items() if k != "balances"}}


@shared_task(name="coins.grant_activity_rewards")
def grant_activity_rewards():
    """Daily job: reward active users with a green handshake."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.coins.models import DAILY_ACTIVITY_REWARD, RARITY_GREEN, CoinTransaction
    from apps.coins.services import credit

    User = get_user_model()
    cutoff = timezone.now() - timedelta(days=1)
    granted = 0
    for user in User.objects.filter(is_active=True, last_seen__gte=cutoff):
        credit(
            user,
            RARITY_GREEN,
            DAILY_ACTIVITY_REWARD,
            CoinTransaction.Type.ACTIVITY,
            memo="Daily activity reward",
        )
        granted += 1
    logger.info("granted daily activity rewards to %s users", granted)
    return granted
