"""Serializers for chat rooms, messages and locked files."""
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import PublicUserSerializer
from apps.chat.models import (
    ChatRoom,
    LockedFile,
    Message,
    PinnedChat,
    RoomMembership,
    SupportTicket,
)

User = get_user_model()


class LockedFileSerializer(serializers.ModelSerializer):
    is_unlocked = serializers.SerializerMethodField()

    class Meta:
        model = LockedFile
        fields = ("id", "price_amount", "price_rarity", "preview_text", "is_unlocked")
        read_only_fields = ("id", "is_unlocked")

    def get_is_unlocked(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request) and obj.is_unlocked_for(request.user)


class MessageSerializer(serializers.ModelSerializer):
    sender = PublicUserSerializer(read_only=True)
    content = serializers.SerializerMethodField()
    locked_file = LockedFileSerializer(read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "room",
            "sender",
            "content",
            "message_type",
            "media",
            "media_meta",
            "reply_to",
            "is_pinned",
            "deleted_for_all",
            "locked_file",
            "edited_at",
            "created_at",
        )
        read_only_fields = ("id", "sender", "deleted_for_all", "edited_at", "created_at")

    def get_content(self, obj) -> str:
        request = self.context.get("request")
        if obj.deleted_for_all:
            return ""
        locked = getattr(obj, "locked_file", None)
        if locked and request and not locked.is_unlocked_for(request.user):
            return ""
        return obj.plaintext


class MessageCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(allow_blank=True, required=False, default="")
    price_amount = serializers.IntegerField(required=False, min_value=1, write_only=True)
    price_rarity = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = Message
        fields = (
            "room",
            "content",
            "message_type",
            "media",
            "media_meta",
            "reply_to",
            "price_amount",
            "price_rarity",
        )

    def validate_room(self, value):
        request = self.context["request"]
        if not value.has_participant(request.user):
            raise serializers.ValidationError("You are not a participant of this room.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        price_amount = validated_data.pop("price_amount", None)
        price_rarity = validated_data.pop("price_rarity", "green")
        body = validated_data.pop("content", "")
        message = Message(sender=self.context["request"].user, **validated_data)
        message.set_plaintext(body)
        if price_amount:
            message.message_type = Message.Type.LOCKED_FILE
        message.save()
        if price_amount:
            LockedFile.objects.create(
                message=message, price_amount=price_amount, price_rarity=price_rarity
            )
        return message

    def to_representation(self, instance):
        return MessageSerializer(instance, context=self.context).data


class RoomMembershipSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)

    class Meta:
        model = RoomMembership
        fields = ("user", "role", "muted", "last_read_at", "joined_at")
        read_only_fields = fields


class ChatRoomSerializer(serializers.ModelSerializer):
    memberships = RoomMembershipSerializer(many=True, read_only=True)
    display_title = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            "id",
            "title",
            "display_title",
            "is_group",
            "is_support",
            "is_garant_chat",
            "avatar",
            "memberships",
            "last_message",
            "unread_count",
            "is_pinned",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_display_title(self, obj) -> str:
        request = self.context.get("request")
        return obj.display_title_for(request.user) if request else obj.title

    def get_last_message(self, obj):
        message = obj.messages.filter(deleted_for_all=False).order_by("-created_at").first()
        return MessageSerializer(message, context=self.context).data if message else None

    def get_unread_count(self, obj) -> int:
        request = self.context.get("request")
        if not request:
            return 0
        membership = obj.memberships.filter(user=request.user).first()
        if membership is None:
            return 0
        queryset = obj.messages.exclude(sender=request.user).filter(deleted_for_all=False)
        if membership.last_read_at:
            queryset = queryset.filter(created_at__gt=membership.last_read_at)
        return queryset.count()

    def get_is_pinned(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request) and PinnedChat.objects.filter(user=request.user, room=obj).exists()


class ChatRoomCreateSerializer(serializers.Serializer):
    participant_usernames = serializers.ListField(
        child=serializers.CharField(), allow_empty=False, max_length=100
    )
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    is_group = serializers.BooleanField(default=False)

    def validate_participant_usernames(self, value):
        users = list(User.objects.filter(username__in=value))
        if len(users) != len(set(value)):
            raise serializers.ValidationError("One or more usernames do not exist.")
        self.context["participants"] = users
        return value

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        participants = self.context["participants"]
        is_group = validated_data.get("is_group") or len(participants) > 1

        if not is_group:
            existing = (
                ChatRoom.objects.filter(is_group=False, participants=request.user)
                .filter(participants=participants[0])
                .first()
            )
            if existing:
                return existing

        room = ChatRoom.objects.create(
            title=validated_data.get("title", ""),
            is_group=is_group,
            created_by=request.user,
        )
        RoomMembership.objects.create(room=room, user=request.user, role=RoomMembership.Role.ADMIN)
        for user in participants:
            if user != request.user:
                RoomMembership.objects.get_or_create(room=room, user=user)
        return room

    def to_representation(self, instance):
        return ChatRoomSerializer(instance, context=self.context).data


class PinnedChatSerializer(serializers.ModelSerializer):
    room = ChatRoomSerializer(read_only=True)

    class Meta:
        model = PinnedChat
        fields = ("id", "room", "order", "created_at")
        read_only_fields = ("id", "room", "created_at")


class SupportTicketSerializer(serializers.ModelSerializer):
    opened_by = PublicUserSerializer(read_only=True)
    room = ChatRoomSerializer(read_only=True)

    class Meta:
        model = SupportTicket
        fields = ("id", "room", "opened_by", "subject", "status", "assigned_to", "created_at", "closed_at")
        read_only_fields = ("id", "room", "opened_by", "status", "assigned_to", "created_at", "closed_at")


class SupportTicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200)
    message = serializers.CharField(max_length=4000)

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        room = ChatRoom.objects.create(
            title=f"Support: {validated_data['subject']}",
            is_support=True,
            created_by=request.user,
        )
        RoomMembership.objects.create(room=room, user=request.user)
        for staff in User.objects.filter(is_staff=True, is_active=True)[:5]:
            RoomMembership.objects.get_or_create(
                room=room, user=staff, defaults={"role": RoomMembership.Role.SUPPORT}
            )
        message = Message(room=room, sender=request.user)
        message.set_plaintext(validated_data["message"])
        message.save()
        return SupportTicket.objects.create(
            room=room, opened_by=request.user, subject=validated_data["subject"]
        )

    def to_representation(self, instance):
        return SupportTicketSerializer(instance, context=self.context).data
