"""WebRTC signaling over Django Channels."""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.calls.models import CallLog
from apps.chat.models import RoomMembership

logger = logging.getLogger(__name__)


class CallConsumer(AsyncJsonWebsocketConsumer):
    """Relays SDP offers/answers and ICE candidates between room participants.

    Endpoint: ``/ws/calls/<room_id>/``. The server never touches media, it only
    brokers signaling messages and keeps the :class:`CallLog` up to date.
    """

    async def connect(self):
        self.user = self.scope.get("user")
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"calls.{self.room_id}"
        self.call_id = None

        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return
        if not await self.is_participant():
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "call.ready", "ice_servers": await self.ice_servers()})

    async def disconnect(self, code):
        if getattr(self, "call_id", None):
            await self.end_call(self.call_id, CallLog.Status.ENDED)
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        handlers = {
            "call_start": self.handle_call_start,
            "offer": self.handle_offer,
            "answer": self.handle_answer,
            "ice_candidate": self.handle_ice_candidate,
            "call_accept": self.handle_call_accept,
            "call_decline": self.handle_call_decline,
            "call_end": self.handle_call_end,
        }
        handler = handlers.get(action)
        if handler is None:
            await self.send_json({"type": "error", "detail": f"Unknown action '{action}'."})
            return
        try:
            await handler(content)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("call action %s failed", action)
            await self.send_json({"type": "error", "detail": str(exc)})

    # ------------------------------------------------------------------
    async def handle_call_start(self, content):
        call_type = content.get("call_type", CallLog.Type.AUDIO)
        self.call_id = await self.create_call(call_type)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.incoming",
                "call_id": self.call_id,
                "call_type": call_type,
                "caller": self.user.username,
                "caller_id": str(self.user.id),
            },
        )

    async def handle_offer(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.offer",
                "sdp": content.get("sdp"),
                "call_id": content.get("call_id") or self.call_id,
                "sender_id": str(self.user.id),
                "sender": self.user.username,
            },
        )

    async def handle_answer(self, content):
        call_id = content.get("call_id") or self.call_id
        if call_id:
            await self.answer_call(call_id)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.answer",
                "sdp": content.get("sdp"),
                "call_id": call_id,
                "sender_id": str(self.user.id),
                "sender": self.user.username,
            },
        )

    async def handle_ice_candidate(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.ice_candidate",
                "candidate": content.get("candidate"),
                "sender_id": str(self.user.id),
            },
        )

    async def handle_call_accept(self, content):
        call_id = content.get("call_id") or self.call_id
        self.call_id = call_id
        if call_id:
            await self.answer_call(call_id)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "call.accepted", "call_id": call_id, "user_id": str(self.user.id)},
        )

    async def handle_call_decline(self, content):
        call_id = content.get("call_id") or self.call_id
        if call_id:
            await self.end_call(call_id, CallLog.Status.DECLINED)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "call.ended", "call_id": call_id, "reason": "declined"},
        )
        self.call_id = None

    async def handle_call_end(self, content):
        call_id = content.get("call_id") or self.call_id
        if call_id:
            await self.end_call(call_id, CallLog.Status.ENDED)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "call.ended", "call_id": call_id, "reason": content.get("reason", "hangup")},
        )
        self.call_id = None

    # ------------------------------------------------------------------
    async def call_incoming(self, event):
        if event["caller_id"] == str(self.user.id):
            self.call_id = event["call_id"]
            return
        self.call_id = event["call_id"]
        await self.send_json({"type": "call.incoming", **{k: v for k, v in event.items() if k != "type"}})

    async def call_offer(self, event):
        if event["sender_id"] == str(self.user.id):
            return
        await self.send_json({"type": "call.offer", **{k: v for k, v in event.items() if k != "type"}})

    async def call_answer(self, event):
        if event["sender_id"] == str(self.user.id):
            return
        await self.send_json({"type": "call.answer", **{k: v for k, v in event.items() if k != "type"}})

    async def call_ice_candidate(self, event):
        if event["sender_id"] == str(self.user.id):
            return
        await self.send_json({"type": "call.ice_candidate", "candidate": event["candidate"]})

    async def call_accepted(self, event):
        await self.send_json({"type": "call.accepted", "call_id": event["call_id"], "user_id": event["user_id"]})

    async def call_ended(self, event):
        await self.send_json({"type": "call.ended", "call_id": event["call_id"], "reason": event["reason"]})

    # ------------------------------------------------------------------
    @database_sync_to_async
    def is_participant(self) -> bool:
        return RoomMembership.objects.filter(room_id=self.room_id, user=self.user).exists()

    @database_sync_to_async
    def create_call(self, call_type: str) -> str:
        call = CallLog.objects.create(
            room_id=self.room_id, caller=self.user, call_type=call_type
        )
        call.participants.add(self.user)
        return str(call.id)

    @database_sync_to_async
    def answer_call(self, call_id: str):
        call = CallLog.objects.filter(id=call_id).first()
        if call is None:
            return
        call.participants.add(self.user)
        if call.status == CallLog.Status.RINGING:
            call.mark_answered()

    @database_sync_to_async
    def end_call(self, call_id: str, status: str):
        call = CallLog.objects.filter(id=call_id).exclude(status=CallLog.Status.ENDED).first()
        if call is not None:
            call.mark_ended(status)

    @database_sync_to_async
    def ice_servers(self):
        from apps.calls.models import IceServer

        servers = [server.as_dict() for server in IceServer.objects.filter(is_active=True)]
        return servers or [{"urls": "stun:stun.l.google.com:19302"}]

    async def encode_json(self, content):  # pragma: no cover - trivial
        return json.dumps(content, default=str)
