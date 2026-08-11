"""Presence consumer: broadcasts online/offline state to contacts."""
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone


class PresenceConsumer(AsyncJsonWebsocketConsumer):
    """Tracks whether a user is online and relays typing/last-seen updates."""

    group_name = "presence"

    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return
        self.user_group = f"presence.{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()
        await self.set_online(True)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "presence.update", "user_id": str(self.user.id), "online": True},
        )

    async def disconnect(self, code):
        if getattr(self, "user", None) is None or not self.user.is_authenticated:
            return
        await self.set_online(False)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "presence.update", "user_id": str(self.user.id), "online": False},
        )
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard(self.user_group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        if action == "ping":
            await self.send_json({"type": "pong", "ts": timezone.now().isoformat()})
        elif action == "heartbeat":
            await self.set_online(True)
            await self.send_json({"type": "heartbeat.ack"})

    async def presence_update(self, event):
        await self.send_json(
            {"type": "presence.update", "user_id": event["user_id"], "online": event["online"]}
        )

    @database_sync_to_async
    def set_online(self, online: bool):
        self.user.is_online = online
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=["is_online", "last_seen"])

    async def encode_json(self, content):  # pragma: no cover - trivial
        return json.dumps(content, default=str)
