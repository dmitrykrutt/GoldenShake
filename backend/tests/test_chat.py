"""Tests for chat rooms, encrypted messages, locked files and WebSocket flow."""
import pytest
from channels.testing import WebsocketCommunicator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import BlockedUser
from apps.chat.encryption import decrypt_message, encrypt_message
from apps.chat.models import ChatRoom, LockedFile, Message, PinnedChat, RoomMembership
from apps.coins.models import RARITY_GREEN, CoinTransaction
from apps.coins.services import credit, get_balance

pytestmark = pytest.mark.django_db


@pytest.fixture
def room(user, other_user):
    room = ChatRoom.objects.create(title="", created_by=user)
    RoomMembership.objects.create(room=room, user=user)
    RoomMembership.objects.create(room=room, user=other_user)
    return room


class TestEncryption:
    def test_roundtrip(self):
        ciphertext = encrypt_message("classified handshake")
        assert isinstance(ciphertext, bytes)
        assert b"classified handshake" not in ciphertext
        assert decrypt_message(ciphertext) == "classified handshake"

    def test_message_content_is_stored_encrypted(self, room, user):
        message = Message(room=room, sender=user)
        message.set_plaintext("secret")
        message.save()
        message.refresh_from_db()
        assert bytes(message.content) != b"secret"
        assert message.plaintext == "secret"

    def test_tampered_ciphertext_fails_gracefully(self):
        assert decrypt_message(b"garbage-bytes") == "[unable to decrypt message]"


class TestChatApi:
    def test_create_direct_room(self, auth_client, other_user):
        response = auth_client.post(
            reverse("v1:chat:room-list"),
            {"participant_usernames": [other_user.username]},
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["is_group"] is False

    def test_direct_room_is_reused(self, auth_client, other_user):
        first = auth_client.post(
            reverse("v1:chat:room-list"),
            {"participant_usernames": [other_user.username]},
            format="json",
        )
        second = auth_client.post(
            reverse("v1:chat:room-list"),
            {"participant_usernames": [other_user.username]},
            format="json",
        )
        assert first.data["id"] == second.data["id"]

    def test_send_and_list_messages(self, auth_client, room):
        created = auth_client.post(
            reverse("v1:chat:message-list"),
            {"room": str(room.id), "content": "hello gold", "message_type": "text"},
            format="json",
        )
        assert created.status_code == 201, created.data
        listing = auth_client.get(reverse("v1:chat:room-messages", kwargs={"pk": room.id}))
        assert listing.status_code == 200
        assert listing.data["results"][0]["content"] == "hello gold"

    def test_non_participant_cannot_post(self, authenticate, user_factory, room):
        outsider = authenticate(user_factory())
        response = outsider.post(
            reverse("v1:chat:message-list"),
            {"room": str(room.id), "content": "let me in"},
            format="json",
        )
        assert response.status_code == 400

    def test_pin_and_unpin_room(self, auth_client, room):
        pinned = auth_client.post(reverse("v1:chat:room-pin", kwargs={"pk": room.id}))
        assert pinned.data["pinned"] is True
        assert PinnedChat.objects.filter(user=auth_client.user, room=room).exists()
        unpinned = auth_client.post(reverse("v1:chat:room-pin", kwargs={"pk": room.id}))
        assert unpinned.data["pinned"] is False

    def test_delete_for_self_hides_message(self, auth_client, room, other_user):
        message = Message(room=room, sender=other_user)
        message.set_plaintext("visible")
        message.save()

        response = auth_client.delete(
            reverse("v1:chat:message-detail", kwargs={"pk": message.id})
        )
        assert response.status_code == 204
        listing = auth_client.get(reverse("v1:chat:room-messages", kwargs={"pk": room.id}))
        assert listing.data["count"] == 0

    def test_delete_for_all_only_by_author(self, auth_client, room, other_user):
        message = Message(room=room, sender=other_user)
        message.set_plaintext("not yours")
        message.save()
        response = auth_client.delete(
            reverse("v1:chat:message-detail", kwargs={"pk": message.id}) + "?for_all=true"
        )
        assert response.status_code == 403

    def test_delete_room_hides_it_for_requesting_user(self, auth_client, room):
        response = auth_client.delete(reverse("v1:chat:room-detail", kwargs={"pk": room.id}))
        assert response.status_code == 204
        listing = auth_client.get(reverse("v1:chat:room-list"))
        assert listing.status_code == 200
        assert listing.data["count"] == 0

    def test_blocked_user_cannot_create_direct_room(self, auth_client, other_user):
        BlockedUser.objects.create(blocker=auth_client.user, blocked=other_user)
        response = auth_client.post(
            reverse("v1:chat:room-list"),
            {"participant_usernames": [other_user.username]},
            format="json",
        )
        assert response.status_code == 400

    def test_media_endpoint_supports_range_requests(self, auth_client, room):
        message = Message.objects.create(
            room=room,
            sender=auth_client.user,
            message_type=Message.Type.VIDEO,
            media=SimpleUploadedFile("clip.mp4", b"0123456789", content_type="video/mp4"),
        )
        response = auth_client.get(
            reverse("v1:chat:media", kwargs={"file_path": message.media.name}),
            HTTP_RANGE="bytes=0-3",
        )
        assert response.status_code == 206
        assert response.content == b"0123"
        assert response["Accept-Ranges"] == "bytes"


class TestLockedFiles:
    def test_unlock_transfers_coins(self, auth_client, room, other_user):
        message = Message(room=room, sender=other_user, message_type=Message.Type.LOCKED_FILE)
        message.set_plaintext("the secret dossier")
        message.save()
        LockedFile.objects.create(message=message, price_amount=5, price_rarity=RARITY_GREEN)
        credit(auth_client.user, RARITY_GREEN, 10, CoinTransaction.Type.ADMIN_GRANT)

        response = auth_client.post(
            reverse("v1:chat:message-unlock", kwargs={"pk": message.id})
        )
        assert response.status_code == 200, response.data
        assert response.data["content"] == "the secret dossier"
        assert get_balance(auth_client.user, RARITY_GREEN) == 5
        assert get_balance(other_user, RARITY_GREEN) == 5

    def test_unlock_without_coins_fails(self, auth_client, room, other_user):
        message = Message(room=room, sender=other_user, message_type=Message.Type.LOCKED_FILE)
        message.set_plaintext("nope")
        message.save()
        LockedFile.objects.create(message=message, price_amount=5, price_rarity=RARITY_GREEN)
        response = auth_client.post(
            reverse("v1:chat:message-unlock", kwargs={"pk": message.id})
        )
        assert response.status_code == 400

    def test_locked_content_hidden_until_unlocked(self, auth_client, room, other_user):
        message = Message(room=room, sender=other_user, message_type=Message.Type.LOCKED_FILE)
        message.set_plaintext("hidden")
        message.save()
        LockedFile.objects.create(message=message, price_amount=5, price_rarity=RARITY_GREEN)
        listing = auth_client.get(reverse("v1:chat:room-messages", kwargs={"pk": room.id}))
        assert listing.data["results"][0]["content"] == ""


@pytest.mark.django_db(transaction=True)
class TestChatWebSocket:
    async def test_send_message_over_websocket(self, room, user):
        from channels.db import database_sync_to_async
        from rest_framework_simplejwt.tokens import RefreshToken

        from config.asgi import application

        token = await database_sync_to_async(lambda: str(RefreshToken.for_user(user).access_token))()
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{room.id}/?token={token}",
            headers=[(b"origin", b"http://localhost")],
        )
        connected, _ = await communicator.connect()
        assert connected

        assert (await communicator.receive_json_from())["type"] == "connection.established"

        await communicator.send_json_to({"action": "send_message", "content": "ws hello"})
        event = await communicator.receive_json_from()
        assert event["type"] == "chat.message"
        assert event["message"]["content"] == "ws hello"

        await communicator.disconnect()

    async def test_rejects_anonymous_connection(self, room):
        from config.asgi import application

        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{room.id}/",
            headers=[(b"origin", b"http://localhost")],
        )
        connected, code = await communicator.connect()
        assert connected is False
        assert code == 4401
