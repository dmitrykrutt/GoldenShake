"""REST endpoints for chat rooms, messages, pins and support tickets."""
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.chat.models import ChatRoom, LockedFile, Message, PinnedChat, SupportTicket
from apps.chat.serializers import (
    ChatRoomCreateSerializer,
    ChatRoomSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    PinnedChatSerializer,
    SupportTicketCreateSerializer,
    SupportTicketSerializer,
)
from apps.coins.models import CoinTransaction
from apps.coins.services import InsufficientCoins, transfer


@extend_schema(tags=["chat"])
class ChatRoomViewSet(viewsets.ModelViewSet):
    """Rooms the authenticated user participates in."""

    permission_classes = [IsAuthenticated]
    serializer_class = ChatRoomSerializer
    queryset = ChatRoom.objects.none()

    def get_queryset(self):
        return (
            ChatRoom.objects.filter(participants=self.request.user)
            .prefetch_related("memberships__user")
            .distinct()
            .order_by("-updated_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ChatRoomCreateSerializer
        return ChatRoomSerializer

    @extend_schema(responses={200: MessageSerializer(many=True)})
    @action(detail=True, methods=["get"], url_path="messages")
    def messages(self, request, pk=None):
        room = self.get_object()
        queryset = (
            room.messages.filter(deleted_for_all=False)
            .exclude(deleted_for_self_users=request.user)
            .select_related("sender")
            .order_by("-created_at")
        )
        page = self.paginate_queryset(queryset)
        serializer = MessageSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        room = self.get_object()
        pin, created = PinnedChat.objects.get_or_create(user=request.user, room=room)
        if not created:
            pin.delete()
        return Response({"room_id": str(room.id), "pinned": created})

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        from django.utils import timezone

        room = self.get_object()
        room.memberships.filter(user=request.user).update(last_read_at=timezone.now())
        return Response({"room_id": str(room.id), "read": True})

    @extend_schema(request=dict, responses={200: ChatRoomSerializer})
    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        room = self.get_object()
        room.memberships.filter(user=request.user).delete()
        return Response({"detail": "You left the room."})


@extend_schema(tags=["chat"])
class MessageViewSet(viewsets.ModelViewSet):
    """Message CRUD (WebSocket is preferred for realtime send)."""

    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    queryset = Message.objects.none()
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            Message.objects.filter(room__participants=self.request.user)
            .exclude(deleted_for_self_users=self.request.user)
            .select_related("sender", "room")
            .distinct()
        )

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return MessageCreateSerializer
        return MessageSerializer

    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        for_all = request.query_params.get("for_all") == "true"
        if for_all and message.sender_id != request.user.id:
            return Response(
                {"detail": "Only the author can delete a message for everyone."},
                status=status.HTTP_403_FORBIDDEN,
            )
        message.soft_delete(request.user, for_all=for_all)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        message = self.get_object()
        locked: LockedFile = getattr(message, "locked_file", None)
        if locked is None:
            return Response({"detail": "This message is not locked."}, status=400)
        if locked.is_unlocked_for(request.user):
            return Response({"unlocked": True, "content": message.plaintext})
        try:
            transfer(
                request.user,
                message.sender,
                locked.price_rarity,
                locked.price_amount,
                CoinTransaction.Type.FILE_UNLOCK,
                memo=f"Unlocked file {message.id}",
            )
        except InsufficientCoins as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        locked.unlocked_by.add(request.user)
        return Response({"unlocked": True, "content": message.plaintext, "media": message.media.url if message.media else None})

    @extend_schema(request=None, responses={200: MessageSerializer})
    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        message = self.get_object()
        message.is_pinned = not message.is_pinned
        message.save(update_fields=["is_pinned"])
        return Response(MessageSerializer(message, context={"request": request}).data)

    @extend_schema(responses={200: MessageSerializer(many=True)})
    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """Search is metadata-only because message bodies are encrypted at rest."""
        room_id = request.query_params.get("room")
        message_type = request.query_params.get("type")
        queryset = self.get_queryset().filter(deleted_for_all=False)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        if message_type:
            queryset = queryset.filter(message_type=message_type)
        page = self.paginate_queryset(queryset.order_by("-created_at"))
        return self.get_paginated_response(
            MessageSerializer(page, many=True, context={"request": request}).data
        )


@extend_schema(tags=["chat"])
class PinnedChatViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PinnedChatSerializer
    queryset = PinnedChat.objects.none()

    def get_queryset(self):
        return PinnedChat.objects.filter(user=self.request.user).select_related("room")


@extend_schema(tags=["support"])
class SupportTicketViewSet(viewsets.ModelViewSet):
    """User-facing support tickets."""

    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketSerializer
    queryset = SupportTicket.objects.none()
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = SupportTicket.objects.select_related("room", "opened_by")
        if user.is_staff:
            return queryset.filter(Q(assigned_to=user) | Q(assigned_to__isnull=True) | Q(opened_by=user))
        return queryset.filter(opened_by=user)

    def get_serializer_class(self):
        if self.action == "create":
            return SupportTicketCreateSerializer
        return SupportTicketSerializer
