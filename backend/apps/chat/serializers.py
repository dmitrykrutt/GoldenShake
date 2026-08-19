import logging
from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import ChatRoom, Message, LockedFile, PinnedChat, RoomMembership

logger = logging.getLogger(__name__)
User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'handshake_level']
        read_only_fields = fields


class LockedFileSerializer(serializers.ModelSerializer):
    is_unlocked = serializers.SerializerMethodField()

    class Meta:
        model = LockedFile
        fields = ['id', 'price_amount', 'price_rarity', 'preview_text', 'is_unlocked']

    def get_is_unlocked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_unlocked_for(request.user)
        return False


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    locked = LockedFileSerializer(source='locked_file', read_only=True)
    is_read = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'room', 'sender', 'content', 'message_type',
            'media', 'media_meta', 'reply_to', 'is_pinned',
            'locked', 'is_read', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_content(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        
        if hasattr(obj, 'locked_file') and obj.locked_file:
            if user and user != obj.sender and not obj.locked_file.is_unlocked_for(user):
                return ""
        
        try:
            return obj.plaintext
        except Exception:
            return obj.ciphertext or ""

    def get_media(self, obj):
        if not obj.media:
            return None
        request = self.context.get('request')
        try:
            url = f"/api/v1/chat/media/{obj.media.name}"
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return str(obj.media)

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.read_by.filter(id=request.user.id).exists()
        return False


class MessageCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True)
    locked_price_amount = serializers.IntegerField(required=False, write_only=True)
    locked_price_rarity = serializers.CharField(required=False, write_only=True)
    locked_preview_text = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'content', 'message_type', 'media', 'media_meta',
            'reply_to', 'locked_price_amount', 'locked_price_rarity', 'locked_preview_text'
        ]

    def create(self, validated_data):
        content = validated_data.pop('content', '')
        locked_price = validated_data.pop('locked_price_amount', None)
        locked_rarity = validated_data.pop('locked_price_rarity', 'green')
        locked_preview = validated_data.pop('locked_preview_text', '')

        message = Message(**validated_data)
        message.set_plaintext(content)
        message.save()

        if locked_price is not None:
            LockedFile.objects.create(
                message=message,
                price_amount=locked_price,
                price_rarity=locked_rarity,
                preview_text=locked_preview,
            )
            message.message_type = Message.Type.LOCKED_FILE
            message.save(update_fields=['message_type'])

        return message


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = ChatUserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            'id', 'title', 'is_group', 'participants',
            'last_message', 'unread_count', 'is_pinned',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_title(self, obj):
        if obj.title:
            return obj.title
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            other = obj.participants.exclude(id=request.user.id).first()
            if other:
                return other.username
        return "Диалог"

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return MessageSerializer(msg, context=self.context).data

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        membership = RoomMembership.objects.filter(room=obj, user=request.user).first()
        if not membership or not membership.last_read_at:
            return obj.messages.exclude(sender=request.user).count()
        return obj.messages.exclude(sender=request.user).filter(created_at__gt=membership.last_read_at).count()

    def get_is_pinned(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return PinnedChat.objects.filter(room=obj, user=request.user).exists()
        return False


class ChatRoomCreateSerializer(serializers.Serializer):
    participant_usernames = serializers.ListField(
        child=serializers.CharField(), required=True, allow_empty=False
    )
    title = serializers.CharField(required=False, allow_blank=True, default='')
    is_group = serializers.BooleanField(default=False)


class PinMessageSerializer(serializers.Serializer):
    is_pinned = serializers.BooleanField(default=True)


class PinnedChatSerializer(serializers.ModelSerializer):
    room = ChatRoomSerializer(read_only=True)

    class Meta:
        model = PinnedChat
        fields = ['id', 'room', 'created_at']
        read_only_fields = fields
