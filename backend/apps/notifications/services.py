"""Helpers to create notifications and fan them out to all channels."""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model

from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


def notify(user, notification_type: str, *, title: str = "", body: str = "", data=None, push: bool = True):
    """Create an in-app notification, push it over WS and optionally to FCM."""
    notification = Notification.objects.create(
        user=user, type=notification_type, title=title, body=body, data=data or {}
    )
    payload = {
        "id": str(notification.id),
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "data": notification.data,
        "read": False,
        "created_at": notification.created_at.isoformat(),
    }
    broadcast(user, payload)
    if push:
        from apps.notifications.tasks import send_push_task

        send_push_task.delay(str(user.id), title, body, data or {})
    return notification


def broadcast(user, payload: dict):
    """Send a payload to the user's personal notification WebSocket group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:  # pragma: no cover - misconfiguration guard
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"notifications.{user.id}", {"type": "notification.message", "payload": payload}
        )
    except Exception as exc:  # pragma: no cover - transport failure
        logger.warning("notification broadcast failed: %s", exc)


def notify_staff(notification_type: str, *, title: str = "", body: str = "", data=None):
    """Notify every active staff member (moderation queues)."""
    User = get_user_model()
    created = []
    for staff in User.objects.filter(is_staff=True, is_active=True):
        created.append(notify(staff, notification_type, title=title, body=body, data=data, push=False))
    return created
