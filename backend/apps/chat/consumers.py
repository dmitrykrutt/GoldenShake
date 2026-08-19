"""Realtime chat consumer with camera toggle signaling."""
import json
import logging
from typing import Optional

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from apps.chat.models import ChatRoom, LockedFile, Message, PinnedChat, RoomMembership

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket endpoint at /ws/chat/<room_id>/."""

    async def connect(self):
        self.user = self.scope.get("user")
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"chat.{self.room_id}"

        if self.user is None or not self.user.is_authenticated:
            await self.close(code=4401)
            return
        if not await self.is_participant():
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {"type": "connection.established", "room_id": str(self.room_id), "user": self.user.username}
        )

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        handlers = {
            "send_message": self.handle_send_message,
            "delete_message": self.handle_delete_message,
            "pin_chat": self.handle_pin_chat,
            "pin_message": self.handle_pin_message,
            "typing": self.handle_typing,
            "read_receipt": self.handle_read_receipt,
            "unlock_file": self.handle_unlock_file,
            # WebRTC Signaling actions
            "call_initiate": self.handle_call_initiate,
            "call_accept": self.handle_call_accept,
            "call_decline": self.handle_call_decline,
            "call_end": self.handle_call_end,
            "call_camera_toggle": self.handle_camera_toggle,
            "call_offer": self.handle_call_relay,
            "call_answer": self.handle_call_relay,
            "call_ice_candidate": self.handle_call_relay,
        }
        handler = handlers.get(action)
        if handler is None:
            await self.send_json({"type": "error", "detail": f"Unknown action '{action}'."})
            return
        try:
            await handler(content)
        except Exception as exc:
            logger.exception("chat action %s failed", action)
            await self.send_json({"type": "error", "detail": str(exc)})

    # ------------------------------------------------------------------
    # WebRTC Signaling Handlers
    # ------------------------------------------------------------------
    async def handle_call_initiate(self, content):
        avatar_url = await self.get_user_avatar_url()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.call_incoming",
                "caller_id": str(self.user.id),
                "caller_username": str(self.user.username),
                "caller_avatar": avatar_url,
                "caller_client_id": content.get("client_id"),
                "is_video": bool(content.get("is_video", False)),
                "room_id": str(self.room_id),
            },
        )

    async def handle_call_accept(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.call_accepted",
                "user_id": str(self.user.id),
                "accepted_client_id": content.get("client_id"),
                "target_client_id": content.get("target_client_id"),
                "room_id": str(self.room_id),
            },
        )

    async def handle_call_decline(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.call_declined",
                "user_id": str(self.user.id),
                "declined_client_id": content.get("client_id"),
                "room_id": str(self.room_id),
            },
        )

    async def handle_call_end(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.call_ended",
                "user_id": str(self.user.id),
                "ended_client_id": content.get("client_id"),
                "target_client_id": content.get("target_client_id"),
                "room_id": str(self.room_id),
            },
        )

    async def handle_camera_toggle(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.call_camera_toggle",
                "sender_id": str(self.user.id),
                "sender_client_id": content.get("client_id"),
                "target_client_id": content.get("target_client_id"),
                "is_camera_on": bool(content.get("is_camera_on", False)),
                "room_id": str(self.room_id),
            },
        )

    async def handle_call_relay(self, content):
        action = content.get("action")
        event_map = {
            "call_offer": "chat.call_offer",
            "call_answer": "chat.call_answer",
            "call_ice_candidate": "chat.call_ice_candidate",
        }
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": event_map[action],
                "sender_id": str(self.user.id),
                "sender_client_id": content.get("client_id"),
                "target_client_id": content.get("target_client_id"),
                "payload": content.get("payload"),
                "room_id": str(self.room_id),
            },
        )

    async def chat_call_incoming(self, event):
        if event["caller_id"] != str(self.user.id):
            await self.send_json(event)

    async def chat_call_accepted(self, event):
        await self.send_json(event)

    async def chat_call_declined(self, event):
        await self.send_json(event)

    async def chat_call_ended(self, event):
        await self.send_json(event)

    async def chat_call_camera_toggle(self, event):
        await self.send_json(event)

    async def chat_call_offer(self, event):
        await self.send_json(event)

    async def chat_call_answer(self, event):
        await self.send_json(event)

    async def chat_call_ice_candidate(self, event):
        await self.send_json(event)

    # ------------------------------------------------------------------
    # Message Actions
    # ------------------------------------------------------------------
    async def handle_send_message(self, content):
        body = (content.get("content") or "").strip()
        message_type = content.get("message_type", Message.Type.TEXT)
        if not body and message_type == Message.Type.TEXT:
            await self.send_json({"type": "error", "detail": "Empty message."})
            return

        message = await self.create_message(
            body=body,
            message_type=message_type,
            reply_to_id=content.get("reply_to"),
            media_meta=content.get("media_meta") or {},
            locked=content.get("locked"),
        )
        await self.channel_layer.group_send(
            self.group_name, {"type": "chat.message", "message": message}
        )
        await self.notify_participants(message)

    async def handle_delete_message(self, content):
        message_id = content.get("message_id")
        for_all = bool(content.get("for_all"))
        deleted = await self.delete_message(message_id, for_all)
        if not deleted:
            await self.send_json({"type": "error", "detail": "Message not found."})
            return
        if for_all:
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "chat.message_deleted", "message_id": str(message_id), "for_all": True},
            )
        else:
            await self.send_json(
                {"type": "chat.message_deleted", "message_id": str(message_id), "for_all": False}
            )

    async def handle_pin_chat(self, content):
        pinned = await self.toggle_pin_chat(bool(content.get("pinned", True)))
        await self.send_json({"type": "chat.pinned", "room_id": str(self.room_id), "pinned": pinned})

    async def handle_pin_message(self, content):
        message_id = content.get("message_id")
        pinned = await self.toggle_pin_message(message_id, bool(content.get("pinned", True)))
        if pinned is None:
            await self.send_json({"type": "error", "detail": "Message not found."})
            return
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.message_pinned", "message_id": str(message_id), "pinned": pinned},
        )

    async def handle_typing(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.typing",
                "user": self.user.username,
                "user_id": str(self.user.id),
                "is_typing": bool(content.get("is_typing", True)),
            },
        )

    async def handle_read_receipt(self, content):
        last_id = content.get("message_id")
        await self.mark_read(last_id)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.read_receipt",
                "user_id": str(self.user.id),
                "user": self.user.username,
                "message_id": str(last_id) if last_id else None,
                "read_at": timezone.now().isoformat(),
            },
        )

    async def handle_unlock_file(self, content):
        result = await self.unlock_file(content.get("message_id"))
        await self.send_json({"type": "chat.file_unlocked", **result})

    async def chat_message(self, event):
        message = event["message"]
        if message.get("locked") and message.get("sender_id") != str(self.user.id):
            message = {**message, "content": "", "locked_preview": True}
        await self.send_json({"type": "chat.message", "message": message})

    async def chat_message_deleted(self, event):
        await self.send_json(
            {"type": "chat.message_deleted", "message_id": event["message_id"], "for_all": event["for_all"]}
        )

    async def chat_message_pinned(self, event):
        await self.send_json(
            {"type": "chat.message_pinned", "message_id": event["message_id"], "pinned": event["pinned"]}
        )

    async def chat_typing(self, event):
        if event["user_id"] == str(self.user.id):
            return
        await self.send_json(
            {"type": "chat.typing", "user": event["user"], "is_typing": event["is_typing"]}
        )

    async def chat_read_receipt(self, event):
        await self.send_json({"type": "chat.read_receipt", **{k: v for k, v in event.items() if k != "type"}})

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------
    @database_sync_to_async
    def is_participant(self) -> bool:
        return RoomMembership.objects.filter(room_id=self.room_id, user=self.user).exists()

    @database_sync_to_async
    def get_user_avatar_url(self) -> Optional[str]:
        if hasattr(self.user, "avatar") and self.user.avatar:
            try:
                return self.user.avatar.url
            except Exception:
                return str(self.user.avatar)
        return None

    @database_sync_to_async
    def create_message(self, body, message_type, reply_to_id=None, media_meta=None, locked=None) -> dict:
        room = ChatRoom.objects.get(id=self.room_id)
        message = Message(
            room=room,
            sender=self.user,
            message_type=message_type,
            media_meta=media_meta or {},
            reply_to_id=reply_to_id or None,
        )
        message.set_plaintext(body)
        message.save()
        message.read_by.add(self.user)

        locked_info = None
        if locked:
            locked_file = LockedFile.objects.create(
                message=message,
                price_amount=int(locked.get("price_amount", 1)),
                price_rarity=locked.get("price_rarity", "green"),
                preview_text=locked.get("preview_text", ""),
            )
            message.message_type = Message.Type.LOCKED_FILE
            message.save(update_fields=["message_type"])
            locked_info = {
                "price_amount": locked_file.price_amount,
                "price_rarity": locked_file.price_rarity,
                "preview_text": locked_file.preview_text,
            }

        room.updated_at = timezone.now()
        room.save(update_fields=["updated_at"])

        return {
            "id": str(message.id),
            "room_id": str(room.id),
            "sender_id": str(self.user.id),
            "sender": self.user.username,
            "content": body,
            "message_type": message.message_type,
            "media_meta": message.media_meta,
            "reply_to": str(message.reply_to_id) if message.reply_to_id else None,
            "locked": locked_info,
            "created_at": message.created_at.isoformat(),
        }

    @database_sync_to_async
    def delete_message(self, message_id, for_all: bool) -> bool:
        message = Message.objects.filter(id=message_id, room_id=self.room_id).first()
        if message is None:
            return False
        if for_all and message.sender_id != self.user.id:
            return False
        message.soft_delete(self.user, for_all=for_all)
        return True

    @database_sync_to_async
    def toggle_pin_chat(self, pinned: bool) -> bool:
        if pinned:
            PinnedChat.objects.get_or_create(user=self.user, room_id=self.room_id)
            return True
        PinnedChat.objects.filter(user=self.user, room_id=self.room_id).delete()
        return False

    @database_sync_to_async
    def toggle_pin_message(self, message_id, pinned: bool) -> Optional[bool]:
        message = Message.objects.filter(id=message_id, room_id=self.room_id).first()
        if message is None:
            return None
        message.is_pinned = pinned
        message.save(update_fields=["is_pinned"])
        return pinned

    @database_sync_to_async
    def mark_read(self, message_id):
        RoomMembership.objects.filter(room_id=self.room_id, user=self.user).update(
            last_read_at=timezone.now()
        )
        if message_id:
            message = Message.objects.filter(id=message_id, room_id=self.room_id).first()
            if message:
                message.read_by.add(self.user)

    @database_sync_to_async
    def unlock_file(self, message_id) -> dict:
        from apps.coins.models import CoinTransaction
        from apps.coins.services import InsufficientCoins, transfer

        locked = LockedFile.objects.filter(message_id=message_id, message__room_id=self.room_id).first()
        if locked is None:
            return {"ok": False, "detail": "Locked file not found."}
        if locked.is_unlocked_for(self.user):
            return {"ok": True, "message_id": str(message_id), "content": locked.message.plaintext}
        try:
            transfer(
                self.user,
                locked.message.sender,
                locked.price_rarity,
                locked.price_amount,
                CoinTransaction.Type.FILE_UNLOCK,
                memo=f"Unlocked file {message_id}",
            )
        except InsufficientCoins as exc:
            return {"ok": False, "detail": str(exc)}
        locked.unlocked_by.add(self.user)
        return {"ok": True, "message_id": str(message_id), "content": locked.message.plaintext}

    @database_sync_to_async
    def _participant_ids(self):
        return list(
            RoomMembership.objects.filter(room_id=self.room_id)
            .exclude(user=self.user)
            .values_list("user_id", flat=True)
        )

    async def notify_participants(self, message: dict):
        from apps.notifications.tasks import send_push_task

        for user_id in await self._participant_ids():
            send_push_task.delay(
                str(user_id),
                f"New message from @{message['sender']}",
                message["content"][:120] if message["message_type"] == "text" else "Sent an attachment",
                {"room_id": message["room_id"], "message_id": message["id"]},
            )
