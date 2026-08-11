"""Celery tasks for account e-mails and GDPR exports."""
import json
import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@shared_task(name="accounts.send_email_confirmation", bind=True, max_retries=3)
def send_email_confirmation_task(self, user_id: str, code: str):
    from apps.notifications.tasks import send_email_task

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.warning("send_email_confirmation: user %s vanished", user_id)
        return False
    return send_email_task(
        user.email,
        "Confirm your GoldenShake account",
        f"Your GoldenShake confirmation code is {code}. "
        f"It expires in {settings.EMAIL_CODE_TTL_MINUTES} minutes.",
    )


@shared_task(name="accounts.send_login_code", bind=True, max_retries=3)
def send_login_code_task(self, user_id: str, code: str):
    from apps.notifications.tasks import send_email_task, send_sms_via_telegram

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return False
    send_email_task(
        user.email,
        "Your GoldenShake login code",
        f"Your one-time login code is {code}. If this wasn't you, change your password now.",
    )
    if user.telegram_chat_id:
        send_sms_via_telegram(user.telegram_chat_id, f"GoldenShake login code: {code}")
    return True


@shared_task(name="accounts.export_user_data")
def export_user_data_task(user_id: str):
    """Assemble a GDPR data export and e-mail it to the account owner."""
    from apps.chat.models import Message
    from apps.coins.models import CoinTransaction, HandshakeCoin
    from apps.notifications.tasks import send_email_task
    from apps.posts.models import Post

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return False

    payload = {
        "profile": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "phone": user.phone,
            "bio": user.bio,
            "social_links": user.social_links,
            "date_joined": user.date_joined.isoformat(),
        },
        "coins": list(
            HandshakeCoin.objects.filter(user=user).values("rarity", "amount")
        ),
        "coin_transactions": list(
            CoinTransaction.objects.filter(from_user=user).values(
                "rarity", "amount", "transaction_type", "created_at"
            )
        )
        + list(
            CoinTransaction.objects.filter(to_user=user).values(
                "rarity", "amount", "transaction_type", "created_at"
            )
        ),
        "message_count": Message.objects.filter(sender=user).count(),
        "posts": list(Post.objects.filter(author=user).values("content", "created_at")),
    }

    send_email_task(
        user.email,
        "Your GoldenShake data export",
        "Attached below is the JSON export of your GoldenShake data.\n\n"
        + json.dumps(payload, indent=2, default=str),
    )
    return True


@shared_task(name="accounts.purge_expired_email_codes")
def purge_expired_email_codes():
    """Housekeeping: delete stale one-time codes."""
    from django.utils import timezone

    from apps.accounts.models import EmailConfirmation

    deleted, _ = EmailConfirmation.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()
    return deleted
