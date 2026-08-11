"""Per-user notification stream."""
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket at ``/ws/notifications/`` pushing in-app notifications live."""

    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return
        self.group_name = f"notifications.{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "notifications.ready", "unread": await self.unread_count()})

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("action") == "mark_read":
            await self.mark_read(content.get("notification_id"))
            await self.send_json({"type": "notifications.read", "unread": await self.unread_count()})

    async def notification_message(self, event):
        await self.send_json({"type": "notification", "notification": event["payload"]})

    @database_sync_to_async
    def unread_count(self) -> int:
        from apps.notifications.models import Notification

        return Notification.objects.filter(user=self.user, read=False).count()

    @database_sync_to_async
    def mark_read(self, notification_id):
        from apps.notifications.models import Notification

        queryset = Notification.objects.filter(user=self.user, read=False)
        if notification_id:
            queryset = queryset.filter(id=notification_id)
        queryset.update(read=True)

    async def encode_json(self, content):  # pragma: no cover - trivial
        return json.dumps(content, default=str)
