"""Celery tasks delivering e-mail, push (FCM) and Telegram messages."""
import logging

import requests
from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    """Lazily initialise the Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if not settings.FCM_CREDENTIALS_FILE:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_app = firebase_admin.get_app()
        else:
            cred = credentials.Certificate(settings.FCM_CREDENTIALS_FILE)
            _firebase_app = firebase_admin.initialize_app(cred)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.warning("Firebase init failed: %s", exc)
        return None
    return _firebase_app


@shared_task(name="notifications.send_email")
def send_email_task(to_email: str, subject: str, body: str, html_body: str = ""):
    """Send a transactional e-mail through the configured SMTP relay."""
    if not to_email:
        return False
    message = EmailMultiAlternatives(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    if html_body:
        message.attach_alternative(html_body, "text/html")
    try:
        message.send(fail_silently=False)
    except Exception as exc:
        logger.error("e-mail delivery to %s failed: %s", to_email, exc)
        return False
    return True


@shared_task(name="notifications.send_push")
def send_push_task(user_id: str, title: str, body: str, data=None):
    """Deliver a push notification to all active devices of a user."""
    from apps.notifications.models import DeviceToken

    app = _get_firebase_app()
    if app is None:
        logger.debug("FCM not configured; skipping push for %s", user_id)
        return False

    from firebase_admin import messaging

    tokens = list(
        DeviceToken.objects.filter(user_id=user_id, is_active=True).values_list("token", flat=True)
    )
    if not tokens:
        return False

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title or "GoldenShake", body=body or ""),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
    )
    try:
        response = messaging.send_each_for_multicast(message)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("push delivery failed: %s", exc)
        return False

    for token, result in zip(tokens, response.responses):
        if not result.success:
            DeviceToken.objects.filter(token=token).update(is_active=False)
    return response.success_count


@shared_task(name="notifications.send_sms_via_telegram")
def send_sms_via_telegram(chat_id: str, text: str):
    """Send an OTP/alert through the Telegram Bot API (our SMS replacement)."""
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = chat_id or settings.TELEGRAM_SMS_CHAT_ID
    if not token or not chat_id:
        logger.debug("Telegram not configured; skipping message")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        response = requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("telegram delivery failed: %s", exc)
        return False
    return True


@shared_task(name="notifications.broadcast_newsletter")
def broadcast_newsletter(subject: str, body: str):
    """Send a newsletter to every opted-in user."""
    User = get_user_model()
    sent = 0
    for user in User.objects.filter(newsletter_opt_in=True, is_active=True):
        if send_email_task(user.email, subject, body):
            sent += 1
    return sent


@shared_task(name="notifications.purge_old_notifications")
def purge_old_notifications(days: int = 60):
    from datetime import timedelta

    from django.utils import timezone

    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = Notification.objects.filter(read=True, created_at__lt=cutoff).delete()
    return deleted
